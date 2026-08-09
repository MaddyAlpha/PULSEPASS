'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, CheckCircle2, XCircle, Loader2, Users,
  RefreshCw, LogOut, Clock, GraduationCap, Plus, Mail
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

type JoinRequest = {
  id: string
  org_id: string
  university_id: string
  college_id: string | null
  status: string
  created_at: string
  org: { name: string; slug: string; description: string | null }
  college: { name: string } | null
}

export default function UniversityAdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [uniName, setUniName] = useState('')
  const [uniId, setUniId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState<{ id: string; note: string } | null>(null)

  const [tab, setTab] = useState<'requests' | 'colleges'>('requests')
  const [colleges, setColleges] = useState<{ id: string; name: string; slug: string; admins?: { id: string; email: string; full_name: string | null; role: string }[] }[]>([])
  const [newCollegeName, setNewCollegeName] = useState('')
  const [addingCollege, setAddingCollege] = useState(false)
  const [assignCollegeEmail, setAssignCollegeEmail] = useState<Record<string, string>>({})

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile || !['university_admin', 'super_admin'].includes(profile.role)) {
      router.push('/events')
      return
    }

    // Get university details
    if (profile.university_id_fk) {
      const { data: uni } = await supabase.from('universities').select('name').eq('id', profile.university_id_fk).single()
      setUniName(uni?.name || 'Your University')
    } else if (profile.role === 'super_admin') {
      setUniName('All Universities')
    }

    // Fetch join requests for this university admin's university
    let query = supabase
      .from('org_join_requests')
      .select(`
        id, org_id, university_id, college_id, status, created_at,
        org:organizations(name, slug, description),
        college:colleges(name)
      `)
      .order('created_at', { ascending: false })

    if (profile.role === 'university_admin' && profile.university_id_fk) {
      query = query.eq('university_id', profile.university_id_fk)
      setUniId(profile.university_id_fk)
      // Fetch colleges
      const { data: cols, error: colsErr } = await supabase.from('colleges').select('id, name, slug, admins:profiles!college_id(id, email, full_name, role)').eq('university_id', profile.university_id_fk).order('name')
      if (colsErr) console.error('Fetch colleges error:', colsErr.message || colsErr)
      setColleges(cols || [])
    }

    const { data } = await query
    setRequests((data as unknown as JoinRequest[]) || [])
    setLoading(false)
  }

  const handleAddCollege = async () => {
    if (!newCollegeName.trim() || !uniId) return
    setAddingCollege(true)
    try {
      const slug = newCollegeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { error } = await supabase.from('colleges').insert({ university_id: uniId, name: newCollegeName.trim(), slug })
      if (error) throw error
      const { data } = await supabase.from('colleges').select('id, name, slug, admins:profiles!college_id(id, email, full_name, role)').eq('university_id', uniId).order('name')
      setColleges(data || [])
      setNewCollegeName('')
      toast.success('College added!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to add college')
    } finally {
      setAddingCollege(false)
    }
  }

  const handleAssignCollegeAdmin = async (email: string, collegeId: string) => {
    if (!email.trim()) return
    setActionLoading(collegeId)
    try {
      const { data: user, error: userErr } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      if (userErr) throw userErr
      if (!user) throw new Error('User not found. They must sign up first.')

      const { error } = await supabase.from('profiles').update({ role: 'college_admin', college_id: collegeId }).eq('id', user.id)
      if (error) throw error

      toast.success(`${user.full_name || user.email} is now a college admin!`)
      setAssignCollegeEmail(prev => ({ ...prev, [collegeId]: '' }))
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign admin')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeCollegeAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke admin access for this user? They will be downgraded to student.')) return
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'student', university_id_fk: null, college_id: null })
        .eq('id', userId)
      if (error) throw error
      toast.success('Admin access revoked.')
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke admin')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (req: JoinRequest) => {
    setActionLoading(req.id)
    try {
      // 1. Update request status
      const { error: reqError } = await supabase
        .from('org_join_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', req.id)
      if (reqError) throw reqError

      // 2. Update the organization to link university
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ university_id: req.university_id, college_id: req.college_id || null })
        .eq('id', req.org_id)
      if (orgError) throw orgError

      // 3. Update org owner's profile
      const { data: org } = await supabase.from('organizations').select('owner_id').eq('id', req.org_id).single()
      if (org) {
        await supabase.from('profiles').update({ university_id_fk: req.university_id }).eq('id', org.owner_id)
      }

      toast.success('Organization approved and linked!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string, note: string) => {
    setActionLoading(id)
    try {
      await supabase
        .from('org_join_requests')
        .update({ status: 'rejected', reviewer_note: note, reviewed_at: new Date().toISOString() })
        .eq('id', id)
      toast.success('Request rejected.')
      setRejectNote(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
    </div>
  )

  const pending = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  return (
    <div className="min-h-screen bg-obsidian-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] sticky top-0 z-50"
        style={{ background: 'rgba(5,7,9,0.97)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.2), rgba(0,255,102,0.05))', border: '1px solid rgba(0,255,102,0.2)' }}>
              <GraduationCap className="w-4 h-4 text-cyber-green" />
            </div>
            <div>
              <p className="font-black text-sm text-cyber-green uppercase tracking-wider">University Portal</p>
              <p className="text-white/40 text-xs">{uniName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/events" className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm">
              <LogOut className="w-4 h-4" /> Back to App
            </Link>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6 mt-4 flex gap-2">
          <button onClick={() => setTab('requests')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'requests' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Join Requests
          </button>
          <button onClick={() => setTab('colleges')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'colleges' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Manage Colleges
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {tab === 'requests' && (
          <div className="space-y-0">
            {/* Pending Requests */}
            <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-black">Pending Requests</h2>
            {pending.length > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <CheckCircle2 className="w-10 h-10 text-cyber-green/30 mx-auto mb-3" />
              <p className="text-white/40">No pending requests. All caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map(req => (
                <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-amber-500/20 p-5"
                  style={{ background: 'rgba(245,158,11,0.03)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <p className="font-bold text-lg">{req.org?.name}</p>
                        <span className="text-xs text-white/30 font-mono">@{req.org?.slug}</span>
                      </div>
                      {req.org?.description && (
                        <p className="text-sm text-white/50 mb-2">{req.org.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-white/40">
                        {req.college && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            College: {req.college.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setRejectNote({ id: req.id, note: '' })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-black transition-all disabled:opacity-50"
                        style={{ background: '#00FF66' }}>
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                    </div>
                  </div>

                  {/* Reject note inline form */}
                  {rejectNote?.id === req.id && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <textarea
                        placeholder="Optional: Reason for rejection (shown to organizer)..."
                        value={rejectNote.note}
                        onChange={e => setRejectNote({ ...rejectNote, note: e.target.value })}
                        rows={2}
                        className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => setRejectNote(null)} className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                        <button
                          onClick={() => handleReject(req.id, rejectNote.note)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-black bg-red-500 transition-all disabled:opacity-50">
                          {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Past Decisions */}
        {reviewed.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-white/50 mb-4">Past Decisions</h3>
            <div className="space-y-3">
              {reviewed.map(req => (
                <div key={req.id} className="rounded-xl border border-white/[0.06] px-5 py-4 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <p className="font-semibold">{req.org?.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{req.college?.name && `${req.college.name} · `}{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                    req.status === 'approved'
                      ? 'text-cyber-green bg-cyber-green/10 border-cyber-green/30'
                      : 'text-red-400 bg-red-400/10 border-red-400/30'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        )}

        {tab === 'colleges' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black">Colleges</h2>
              <div className="flex gap-2 w-1/2">
                <input
                  placeholder="New college name (e.g. College of Engineering)"
                  value={newCollegeName}
                  onChange={e => setNewCollegeName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCollege()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyber-green transition-colors" />
                <button
                  onClick={handleAddCollege}
                  disabled={addingCollege || !newCollegeName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black transition-all disabled:opacity-50"
                  style={{ background: '#00FF66' }}>
                  {addingCollege ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add College
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colleges.map(c => (
                <div key={c.id} className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      <p className="text-sm text-white/40 font-mono mt-0.5">/c/{c.slug}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                      <GraduationCap className="w-5 h-5 text-white/50" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/[0.06]">
                    <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">Assign College Admin</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="email"
                          placeholder="User's email..."
                          value={assignCollegeEmail[c.id] || ''}
                          onChange={e => setAssignCollegeEmail(prev => ({ ...prev, [c.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAssignCollegeAdmin(assignCollegeEmail[c.id], c.id)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cyber-green transition-colors" />
                      </div>
                      <button
                        onClick={() => handleAssignCollegeAdmin(assignCollegeEmail[c.id], c.id)}
                        disabled={actionLoading === c.id || !assignCollegeEmail[c.id]?.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-40 transition-all"
                        style={{ background: '#00FF66' }}>
                        {actionLoading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
                      </button>
                    </div>
                    {/* Assigned College Admins */}
                    {c.admins && c.admins.filter(a => a.role === 'college_admin').length > 0 && (
                      <div className="mt-3 space-y-2">
                        {c.admins.filter(a => a.role === 'college_admin').map(admin => (
                          <div key={admin.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-cyber-green/20 text-cyber-green flex items-center justify-center text-[10px] font-bold">
                                {(admin.full_name || admin.email)[0].toUpperCase()}
                              </div>
                              <div className="leading-tight">
                                <p className="text-xs font-medium text-white/80">{admin.full_name || 'No Name'}</p>
                                <p className="text-[10px] text-white/40">{admin.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeCollegeAdmin(admin.id)}
                              disabled={actionLoading === admin.id}
                              className="text-[10px] px-2 py-1 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                              {actionLoading === admin.id ? '...' : 'Revoke'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {colleges.length === 0 && (
                <div className="col-span-full py-12 text-center border border-white/[0.06] rounded-2xl border-dashed">
                  <p className="text-white/40">No colleges added yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
