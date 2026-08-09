'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Building2, Plus, Shield, Zap, AlertTriangle,
  ToggleLeft, ToggleRight, Eye, Trash2, Check, X,
  ChevronRight, Activity, Users, Ticket, BarChart3,
  Power, RefreshCw, LogOut, Loader2, Search, GraduationCap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { University, AuditLog, PlatformStats, CreateUniversityForm } from '@/lib/types'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type TabId = 'overview' | 'universities' | 'audit' | 'flags'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Platform Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'universities', label: 'Universities', icon: <Building2 className="w-4 h-4" /> },
  { id: 'audit', label: 'Audit Log', icon: <Activity className="w-4 h-4" /> },
  { id: 'flags', label: 'Feature Flags', icon: <ToggleLeft className="w-4 h-4" /> },
]

type CollegeRow = { id: string; name: string; slug: string; admins?: { id: string; email: string; full_name: string | null; role: string }[] }

export default function SuperAdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [universities, setUniversities] = useState<University[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [killSwitchTarget, setKillSwitchTarget] = useState<University | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [auditSearch, setAuditSearch] = useState('')

  // College management
  const [expandedColleges, setExpandedColleges] = useState<string | null>(null) // university id
  const [colleges, setColleges] = useState<Record<string, CollegeRow[]>>({}) // uni_id -> colleges
  const [newCollegeName, setNewCollegeName] = useState('')
  const [addingCollege, setAddingCollege] = useState(false)

  // Admin Assignment
  const [assignUniEmail, setAssignUniEmail] = useState<Record<string, string>>({}) // uni_id -> email
  const [assignCollegeEmail, setAssignCollegeEmail] = useState<Record<string, string>>({}) // college_id -> email
  const [assigningLoading, setAssigningLoading] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CreateUniversityForm>({
    name: '',
    slug: '',
    feature_flags: {
      ocr_required: true,
      vip_enabled: true,
      manual_review_enabled: true,
      ocr_keywords: [],
    },
  })
  const [keywordsInput, setKeywordsInput] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [univRes, auditRes, statsRes] = await Promise.all([
        supabase.from('universities').select('*, admins:profiles!university_id_fk(id, email, full_name, role)').order('created_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('*, actor:profiles!actor_id(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(100),
        Promise.all([
          supabase.from('universities').select('id', { count: 'exact', head: true }),
          supabase.from('events').select('id', { count: 'exact', head: true }),
          supabase.from('tickets').select('id', { count: 'exact', head: true }),
          supabase.from('checkins').select('id', { count: 'exact', head: true }),
          supabase.from('universities').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]),
      ])

      if (univRes.data) setUniversities(univRes.data as University[])
      if (auditRes.data) setAuditLogs(auditRes.data as AuditLog[])

      const [uCount, eCount, tCount, cCount, auCount] = statsRes
      setStats({
        total_universities: uCount.count || 0,
        total_events: eCount.count || 0,
        total_tickets: tCount.count || 0,
        total_checkins: cCount.count || 0,
        active_universities: auCount.count || 0,
      })
    } catch (err) {
      console.error('SuperAdmin fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateUniversity = async () => {
    if (!createForm.name || !createForm.slug) return
    setActionLoading('create')
    try {
      const keywords = keywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)

      const { error } = await supabase.from('universities').insert({
        ...createForm,
        feature_flags: { ...createForm.feature_flags, ocr_keywords: keywords },
      })

      if (!error) {
        setShowCreateForm(false)
        setCreateForm({
          name: '', slug: '',
          feature_flags: { ocr_required: true, vip_enabled: true, manual_review_enabled: true, ocr_keywords: [] },
        })
        setKeywordsInput('')
        await fetchData()
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleKillSwitch = async (university: University) => {
    setActionLoading(university.id)
    try {
      await supabase
        .from('universities')
        .update({ is_active: !university.is_active })
        .eq('id', university.id)
      setKillSwitchTarget(null)
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleFlag = async (university: University, flag: keyof University['feature_flags']) => {
    if (typeof university.feature_flags[flag] !== 'boolean') return
    const updated = {
      ...university.feature_flags,
      [flag]: !university.feature_flags[flag],
    }
    await supabase.from('universities').update({ feature_flags: updated }).eq('id', university.id)
    await fetchData()
  }

  const handleLoadColleges = async (uniId: string) => {
    if (expandedColleges === uniId) { setExpandedColleges(null); return }
    setExpandedColleges(uniId)
    if (!colleges[uniId]) {
      const { data, error } = await supabase.from('colleges').select('id, name, slug, admins:profiles!college_id(id, email, full_name, role)').eq('university_id', uniId).order('name')
      if (error) console.error('Fetch colleges error:', error)
      setColleges(prev => ({ ...prev, [uniId]: data || [] }))
    }
  }

  const handleAddCollege = async (uniId: string) => {
    if (!newCollegeName.trim()) return
    setAddingCollege(true)
    try {
      const slug = newCollegeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { error } = await supabase.from('colleges').insert({ university_id: uniId, name: newCollegeName.trim(), slug })
      if (error) throw error
      const { data } = await supabase.from('colleges').select('id, name, slug, admins:profiles!college_id(id, email, full_name, role)').eq('university_id', uniId).order('name')
      setColleges(prev => ({ ...prev, [uniId]: data || [] }))
      setNewCollegeName('')
      toast.success('College added!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to add college')
    } finally {
      setAddingCollege(false)
    }
  }

  const handleAssignAdmin = async (email: string, role: 'university_admin' | 'college_admin', entityId: string) => {
    if (!email.trim()) return
    setAssigningLoading(entityId)
    try {
      // Find user by email
      const { data: user, error: userErr } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
        
      if (userErr) throw userErr
      if (!user) throw new Error('User not found. They must sign up first.')

      // Update role
      const updateData: any = { role }
      if (role === 'university_admin') {
        updateData.university_id_fk = entityId
      } else if (role === 'college_admin') {
        updateData.college_id = entityId
      }

      const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id)
      if (error) throw error

      toast.success(`${user.full_name || user.email} is now a ${role.replace('_', ' ')}!`)
      if (role === 'university_admin') setAssignUniEmail(prev => ({ ...prev, [entityId]: '' }))
      if (role === 'college_admin') setAssignCollegeEmail(prev => ({ ...prev, [entityId]: '' }))
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign admin')
    } finally {
      setAssigningLoading(null)
    }
  }

  const handleRevokeAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke admin access for this user? They will be downgraded to student.')) return
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'student', university_id_fk: null, college_id: null })
        .eq('id', userId)
      if (error) throw error
      toast.success('Admin access revoked.')
      
      // refresh data
      await fetchData()
      // If expanded colleges, we need to refresh that specific college's admins. 
      // But we can just clear expandedColleges to force refetch, or let the user click again.
      // For simplicity we will re-fetch the expanded college if any.
      if (expandedColleges) {
        const { data } = await supabase.from('colleges').select('id, name, slug, admins:profiles!college_id(id, email, full_name, role)').eq('university_id', expandedColleges).order('name')
        setColleges(prev => ({ ...prev, [expandedColleges]: data || [] }))
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke admin')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredLogs = auditLogs.filter(
    (l) =>
      !auditSearch ||
      l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (l.actor as any)?.email?.toLowerCase().includes(auditSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-cyber-green animate-spin" />
          <p className="text-white/40 text-sm">Loading Super Admin Portal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] sticky top-0 z-50"
        style={{ background: 'rgba(5,7,9,0.97)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00FF66, #00CC44)' }}>
              <Shield className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="font-black text-sm tracking-wider text-cyber-green uppercase">PulsePass</p>
              <p className="text-white/40 text-xs">Super Admin Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyber-green text-cyber-green'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-black mb-6">Platform Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
              {[
                { label: 'Universities', value: stats.total_universities, icon: <Building2 />, color: '#00FF66' },
                { label: 'Active', value: stats.active_universities, icon: <Globe />, color: '#00CC44' },
                { label: 'Total Events', value: stats.total_events, icon: <Zap />, color: '#A78BFA' },
                { label: 'Tickets Issued', value: stats.total_tickets, icon: <Ticket />, color: '#60A5FA' },
                { label: 'Total Check-Ins', value: stats.total_checkins, icon: <Users />, color: '#F59E0B' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/[0.06] p-5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ color: stat.color, background: `${stat.color}15` }}>
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value.toLocaleString()}</p>
                  <p className="text-white/40 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Active Universities quick view */}
            <h3 className="font-bold text-lg mb-4 text-white/70">Active Universities</h3>
            <div className="space-y-3">
              {universities.filter(u => u.is_active).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06]"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                    <p className="font-semibold">{u.name}</p>
                    <span className="text-white/30 text-sm font-mono">/u/{u.slug}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── UNIVERSITIES TAB ── */}
        {activeTab === 'universities' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black">Universities</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: '#00FF66', color: '#000' }}>
                <Plus className="w-4 h-4" />
                Provision University
              </button>
            </div>

            {/* Create University Form */}
            <AnimatePresence>
              {showCreateForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 rounded-2xl border border-cyber-green/30 overflow-hidden"
                  style={{ background: 'rgba(0,255,102,0.04)' }}>
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-4 text-cyber-green">New University</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">University Name *</label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="e.g., CSKHPKV University"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyber-green transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">URL Slug *</label>
                        <div className="flex items-center gap-2">
                          <span className="text-white/30 text-sm">/u/</span>
                          <input
                            type="text"
                            value={createForm.slug}
                            onChange={(e) => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                            placeholder="cskhpkv"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyber-green transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Default OCR Keywords (comma-separated)</label>
                      <input
                        type="text"
                        value={keywordsInput}
                        onChange={(e) => setKeywordsInput(e.target.value)}
                        placeholder="e.g., Krishi Vishvavidyalaya, Life Science"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyber-green transition-colors"
                      />
                      <p className="text-white/30 text-xs mt-1">Case-insensitive. Event creators can override per event.</p>
                    </div>
                    <div className="flex gap-3 mb-4">
                      {[
                        { key: 'ocr_required', label: 'OCR Required' },
                        { key: 'vip_enabled', label: 'VIP Passes' },
                        { key: 'manual_review_enabled', label: 'Manual Review' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createForm.feature_flags[key as keyof typeof createForm.feature_flags] as boolean}
                            onChange={(e) => setCreateForm(f => ({
                              ...f,
                              feature_flags: { ...f.feature_flags, [key]: e.target.checked }
                            }))}
                            className="accent-cyber-green"
                          />
                          <span className="text-sm text-white/70">{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCreateUniversity}
                        disabled={actionLoading === 'create'}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                        style={{ background: '#00FF66', color: '#000' }}>
                        {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Create University
                      </button>
                      <button onClick={() => setShowCreateForm(false)}
                        className="px-5 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {universities.map((u) => (
                <motion.div key={u.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: u.is_active ? 'rgba(255,255,255,0.06)' : 'rgba(255,50,80,0.3)',
                    background: u.is_active ? 'rgba(255,255,255,0.02)' : 'rgba(255,50,80,0.04)'
                  }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${u.is_active ? 'bg-cyber-green animate-pulse' : 'bg-red-400'}`} />
                        <div>
                          <p className="font-bold">{u.name}</p>
                          <p className="text-white/40 text-sm font-mono">/u/{u.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.is_active ? 'text-cyber-green bg-cyber-green/10' : 'text-red-400 bg-red-400/10'}`}>
                          {u.is_active ? 'ACTIVE' : 'KILLED'}
                        </span>
                        {/* Kill Switch */}
                        <button
                          onClick={() => setKillSwitchTarget(u)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            u.is_active
                              ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                              : 'text-cyber-green bg-cyber-green/10 hover:bg-cyber-green/20'
                          }`}>
                          <Power className="w-3.5 h-3.5" />
                          {u.is_active ? 'Kill' : 'Restore'}
                        </button>
                      </div>
                    </div>
                    {/* Feature flags */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(u.feature_flags)
                        .filter(([k]) => k !== 'ocr_keywords')
                        .map(([key, val]) => (
                          <span key={key}
                            className={`text-xs px-2.5 py-1 rounded-full border ${val ? 'border-white/10 text-white/50' : 'border-red-400/30 text-red-400/70 line-through'}`}>
                            {key.replace(/_/g, ' ')}
                          </span>
                        ))}
                      {u.feature_flags.ocr_keywords?.length > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/50">
                          {u.feature_flags.ocr_keywords.length} OCR keyword{u.feature_flags.ocr_keywords.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Assign University Admin */}
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-2 font-medium">Assign University Admin</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="User's email address..."
                          value={assignUniEmail[u.id] || ''}
                          onChange={e => setAssignUniEmail(prev => ({ ...prev, [u.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAssignAdmin(assignUniEmail[u.id], 'university_admin', u.id)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyber-green transition-colors" />
                        <button
                          onClick={() => handleAssignAdmin(assignUniEmail[u.id], 'university_admin', u.id)}
                          disabled={assigningLoading === u.id || !assignUniEmail[u.id]?.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40 transition-all"
                          style={{ background: '#00FF66' }}>
                          {assigningLoading === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Assign
                        </button>
                      </div>
                      
                      {/* Assigned University Admins */}
                      {u.admins && u.admins.filter(a => a.role === 'university_admin').length > 0 && (
                        <div className="mt-3 space-y-2">
                          {u.admins.filter(a => a.role === 'university_admin').map(admin => (
                            <div key={admin.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-cyber-green/20 text-cyber-green flex items-center justify-center text-xs font-bold">
                                  {(admin.full_name || admin.email)[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{admin.full_name || 'No Name'}</p>
                                  <p className="text-xs text-white/50">{admin.email}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRevokeAdmin(admin.id)}
                                disabled={actionLoading === admin.id}
                                className="px-3 py-1 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                                {actionLoading === admin.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Revoke'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* College management section */}
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <button onClick={() => handleLoadColleges(u.id)}
                        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                        <GraduationCap className="w-4 h-4" />
                        {expandedColleges === u.id ? 'Hide Colleges' : `Manage Colleges${colleges[u.id] ? ` (${colleges[u.id].length})` : ''}`}
                      </button>
                      {expandedColleges === u.id && (
                        <div className="mt-4 space-y-2">
                          {(colleges[u.id] || []).map(c => (
                            <div key={c.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{c.name}</span>
                                <span className="text-xs font-mono text-white/30">{c.slug}</span>
                              </div>
                              {/* Assign College Admin */}
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  placeholder="Assign College Admin (Email)"
                                  value={assignCollegeEmail[c.id] || ''}
                                  onChange={e => setAssignCollegeEmail(prev => ({ ...prev, [c.id]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && handleAssignAdmin(assignCollegeEmail[c.id], 'college_admin', c.id)}
                                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-cyber-green transition-colors" />
                                <button
                                  onClick={() => handleAssignAdmin(assignCollegeEmail[c.id], 'college_admin', c.id)}
                                  disabled={assigningLoading === c.id || !assignCollegeEmail[c.id]?.trim()}
                                  className="px-3 py-1.5 rounded-md text-xs font-bold text-black disabled:opacity-40"
                                  style={{ background: '#00FF66' }}>
                                  {assigningLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Assign'}
                                </button>
                              </div>

                              {/* Assigned College Admins */}
                              {c.admins && c.admins.filter(a => a.role === 'college_admin').length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {c.admins.filter(a => a.role === 'college_admin').map(admin => (
                                    <div key={admin.id} className="flex items-center justify-between p-1.5 rounded-md bg-black/20">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-cyber-green/20 text-cyber-green flex items-center justify-center text-[10px] font-bold">
                                          {(admin.full_name || admin.email)[0].toUpperCase()}
                                        </div>
                                        <div className="leading-tight">
                                          <p className="text-xs font-medium text-white/80">{admin.full_name || 'No Name'}</p>
                                          <p className="text-[10px] text-white/40">{admin.email}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleRevokeAdmin(admin.id)}
                                        disabled={actionLoading === admin.id}
                                        className="text-[10px] px-2 py-0.5 rounded text-red-400 hover:bg-red-500/10 transition-colors">
                                        {actionLoading === admin.id ? '...' : 'Revoke'}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {(colleges[u.id] || []).length === 0 && (
                            <p className="text-xs text-white/30 py-2">No colleges yet. Add one below.</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <input
                              placeholder="e.g. College of Agriculture"
                              value={newCollegeName}
                              onChange={e => setNewCollegeName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddCollege(u.id)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyber-green transition-colors" />
                            <button onClick={() => handleAddCollege(u.id)} disabled={addingCollege || !newCollegeName.trim()}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40"
                              style={{ background: '#00FF66' }}>
                              {addingCollege ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── AUDIT LOG TAB ── */}
        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black">Audit Log</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search by action or actor..."
                  className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyber-green transition-colors w-72"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Action', 'Actor', 'Target', 'Timestamp'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-white/40 text-xs uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">No audit logs yet</td></tr>
                  ) : filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 text-white/70">{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-white/60">{(log.actor as any)?.email || log.actor_id?.slice(0, 8) + '...'}</td>
                      <td className="px-4 py-3 text-white/40 font-mono text-xs">
                        {log.target_table && `${log.target_table}:${log.target_id?.slice(0, 8) || ''}`}
                      </td>
                      <td className="px-4 py-3 text-white/30 text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── FEATURE FLAGS TAB ── */}
        {activeTab === 'flags' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-black mb-6">Feature Flags</h2>
            <div className="space-y-4">
              {universities.map((u) => (
                <div key={u.id} className="rounded-2xl border border-white/[0.06] p-6"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="font-bold mb-4">{u.name}</p>
                  <div className="space-y-3">
                    {[
                      { key: 'ocr_required', label: 'OCR Required', desc: 'Students must scan ID card to claim passes' },
                      { key: 'vip_enabled', label: 'VIP Passes Enabled', desc: 'Allow org admins to issue VIP passes' },
                      { key: 'manual_review_enabled', label: 'Manual Review Fallback', desc: 'Allow students to submit for manual review on OCR failure' },
                    ].map(({ key, label, desc }) => {
                      const val = u.feature_flags[key as keyof typeof u.feature_flags] as boolean
                      return (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-white/40">{desc}</p>
                          </div>
                          <button
                            onClick={() => handleToggleFlag(u, key as keyof University['feature_flags'])}
                            className={`relative w-12 h-6 rounded-full transition-all ${val ? 'bg-cyber-green' : 'bg-white/10'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-black rounded-full transition-all ${val ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      )
                    })}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-sm font-medium mb-1">OCR Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {u.feature_flags.ocr_keywords?.length ? u.feature_flags.ocr_keywords.map((kw) => (
                          <span key={kw} className="text-xs px-2.5 py-1 rounded-full border border-cyber-green/30 text-cyber-green/70">{kw}</span>
                        )) : <span className="text-white/30 text-xs">No keywords set</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Kill Switch Confirm Modal */}
      <AnimatePresence>
        {killSwitchTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl border p-6 max-w-md w-full"
              style={{ background: 'rgba(20,5,5,0.95)', borderColor: 'rgba(255,50,80,0.4)' }}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h3 className="font-bold text-lg">
                  {killSwitchTarget.is_active ? 'Kill University Access?' : 'Restore University Access?'}
                </h3>
              </div>
              <p className="text-white/60 text-sm mb-6">
                {killSwitchTarget.is_active
                  ? `This will immediately block all routes for "${killSwitchTarget.name}". Active sessions will be denied on next request.`
                  : `This will restore access for "${killSwitchTarget.name}".`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleKillSwitch(killSwitchTarget)}
                  disabled={actionLoading === killSwitchTarget.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${
                    killSwitchTarget.is_active ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-black'
                  }`}
                  style={!killSwitchTarget.is_active ? { background: '#00FF66' } : {}}>
                  {actionLoading === killSwitchTarget.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Power className="w-4 h-4" />}
                  {killSwitchTarget.is_active ? 'Confirm Kill' : 'Restore Access'}
                </button>
                <button onClick={() => setKillSwitchTarget(null)}
                  className="px-5 py-3 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
