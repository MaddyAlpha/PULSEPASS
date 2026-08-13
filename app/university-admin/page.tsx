'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, CheckCircle2, XCircle, Loader2, Users,
  RefreshCw, LogOut, Clock, GraduationCap, Plus, Mail, Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import VisualRegexBuilder, { RegexBlock } from '@/components/ui/VisualRegexBuilder'

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

type RoleRequest = {
  id: string
  user_id: string
  college_id: string
  university_id: string
  invite_code: string
  status: string
  created_at: string
  profile: { full_name: string | null; email: string; roll_number: string | null }
  college: { name: string }
}

type BatchCode = {
  id: string
  batch_prefix: string
  created_at: string
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

  const [tab, setTab] = useState<'requests' | 'colleges' | 'organiser_requests' | 'batch_codes' | 'security'>('requests')
  const [colleges, setColleges] = useState<{ id: string; name: string; slug: string; admins?: { id: string; email: string; full_name: string | null; role: string }[] }[]>([])
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([])
  const [batchCodes, setBatchCodes] = useState<BatchCode[]>([])
  const [newBatchPrefix, setNewBatchPrefix] = useState('')
  
  // Security / Regex state
  const [uniRegexBlocks, setUniRegexBlocks] = useState<RegexBlock[]>([])
  const [uniRegexStr, setUniRegexStr] = useState('')
  const [uniRegexHint, setUniRegexHint] = useState('')
  
  const [newCollegeName, setNewCollegeName] = useState('')
  const [addingCollege, setAddingCollege] = useState(false)
  const [assignCollegeEmail, setAssignCollegeEmail] = useState<Record<string, string>>({})
  const [collegeInviteCodes, setCollegeInviteCodes] = useState<Record<string, any[]>>({})

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile || !['university_admin', 'super_admin'].includes(profile.role)) {
      router.push('/auth')
      return
    }

    // Get university details
    if (profile.university_id_fk) {
      const { data: uni } = await supabase.from('universities').select('name, roll_number_regex, roll_number_format_hint, roll_number_regex_blocks').eq('id', profile.university_id_fk).single()
      setUniName(uni?.name || 'Your University')
      if (uni?.roll_number_regex_blocks) setUniRegexBlocks(uni.roll_number_regex_blocks as unknown as RegexBlock[])
      if (uni?.roll_number_regex) setUniRegexStr(uni.roll_number_regex)
      if (uni?.roll_number_format_hint) setUniRegexHint(uni.roll_number_format_hint)
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
      const { data: cols, error: colsErr } = await supabase.from('colleges').select('id, name, slug').eq('university_id', profile.university_id_fk).order('name')
      if (colsErr) console.error('Fetch colleges error:', colsErr.message || colsErr)
      
      const collegesList = cols || []
      
      // Fetch admins separately to avoid PostgREST relationship RLS errors
      if (collegesList.length > 0) {
        const collegeIds = collegesList.map(c => c.id)
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, college_id')
          .in('college_id', collegeIds)
          .eq('role', 'college_admin')
          
        collegesList.forEach(c => {
          (c as any).admins = admins?.filter(a => a.college_id === c.id) || []
        })
      }
      
      setColleges(collegesList as any)

      // Fetch role requests (organiser applications)
      const { data: roles } = await supabase
        .from('role_requests')
        .select(`
          id, user_id, college_id, university_id, invite_code, status, created_at,
          profile:profiles!user_id(full_name, email, roll_number),
          college:colleges(name)
        `)
        .eq('university_id', profile.university_id_fk)
        .order('created_at', { ascending: false })
      setRoleRequests((roles as unknown as RoleRequest[]) || [])
      
      // Fetch batch codes
      const { data: batches } = await supabase
        .from('university_batch_codes')
        .select('id, batch_prefix, created_at')
        .eq('university_id', profile.university_id_fk)
        .order('batch_prefix')
      setBatchCodes(batches || [])

      // Fetch one-time codes
      const { data: codes } = await supabase.from('admin_invite_codes')
        .select('*')
        .eq('university_id', profile.university_id_fk)
        .eq('role', 'college_admin')
        .order('created_at', { ascending: false })
      if (codes) {
        const codesByCollege = codes.reduce((acc, code) => {
          if (!acc[code.college_id]) acc[code.college_id] = []
          acc[code.college_id].push(code)
          return acc
        }, {} as Record<string, any[]>)
        setCollegeInviteCodes(codesByCollege)
      }
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
      const { data: cols } = await supabase.from('colleges').select('id, name, slug').eq('university_id', uniId).order('name')
      const collegesList = cols || []
      if (collegesList.length > 0) {
        const collegeIds = collegesList.map(c => c.id)
        const { data: admins } = await supabase.from('profiles').select('id, email, full_name, role, college_id').in('college_id', collegeIds).eq('role', 'college_admin')
        collegesList.forEach(c => {
          (c as any).admins = admins?.filter(a => a.college_id === c.id) || []
        })
      }
      setColleges(collegesList as any)
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

  const handleGenerateCollegeAdminCode = async (collegeId: string) => {
    setActionLoading(`generate_${collegeId}`)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not logged in')
      
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { error } = await supabase.from('admin_invite_codes').insert({
        code,
        role: 'college_admin',
        university_id: uniId,
        college_id: collegeId,
        created_by: user.user.id
      })
      if (error) throw error
      toast.success('Generated one-time use code for College Admin')
      await fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate code')
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

  const handleApproveRole = async (req: RoleRequest) => {
    setActionLoading(req.id)
    try {
      // 1. Update request status
      const { error: reqError } = await supabase
        .from('role_requests')
        .update({ status: 'approved', reviewed_by: (await supabase.auth.getUser()).data.user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', req.id)
      if (reqError) throw reqError

      // 2. Elevate user to organiser
      const { error: profError } = await supabase
        .from('profiles')
        .update({ role: 'organiser', college_id: req.college_id })
        .eq('id', req.user_id)
      if (profError) throw profError

      toast.success('Organiser role granted!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectRole = async (reqId: string) => {
    setActionLoading(reqId)
    try {
      await supabase
        .from('role_requests')
        .update({ status: 'rejected', reviewed_by: (await supabase.auth.getUser()).data.user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', reqId)
      toast.success('Organiser request rejected.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddBatchCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uniId) {
      toast.error('You must be logged in as a University Admin to add batch codes.')
      return
    }
    if (!newBatchPrefix.trim()) return
    setActionLoading('add_batch')
    try {
      const { error } = await supabase.from('university_batch_codes').insert({
        university_id: uniId,
        batch_prefix: newBatchPrefix.trim().toUpperCase(),
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      if (error) throw error
      toast.success('Batch code added!')
      setNewBatchPrefix('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add batch code')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteBatchCode = async (id: string) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('university_batch_codes').delete().eq('id', id)
      if (error) throw error
      toast.success('Batch code removed')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove batch code')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveRegex = async () => {
    if (!uniId) {
      toast.error('You must be logged in as a University Admin to save the Regex format.')
      return
    }
    setActionLoading('save_regex')
    try {
      const { error } = await supabase.from('universities').update({
        roll_number_regex: uniRegexStr,
        roll_number_format_hint: uniRegexHint,
        roll_number_regex_blocks: uniRegexBlocks
      }).eq('id', uniId)
      if (error) throw error
      toast.success('Roll Number format saved!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save format')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div className="min-h-[100dvh] bg-obsidian-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
    </div>
  )

  const pending = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  return (
    <div className="min-h-[100dvh] bg-obsidian-950 text-white">
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
            <Link href="/my-passes" className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all text-sm">
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
          <button onClick={() => setTab('organiser_requests')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'organiser_requests' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Organiser Applications
          </button>
          <button onClick={() => setTab('batch_codes')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'batch_codes' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Batch Codes
          </button>
          <button onClick={() => setTab('security')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'security' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Security
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
                    <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">Assign College Admin (Or Gen Code)</p>
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
                      <button
                        onClick={() => handleGenerateCollegeAdminCode(c.id)}
                        disabled={actionLoading === `generate_${c.id}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-all disabled:opacity-40">
                        {actionLoading === `generate_${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Gen Code
                      </button>
                    </div>

                    {/* Invite Codes List */}
                    {collegeInviteCodes[c.id] && collegeInviteCodes[c.id].length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-white/30 tracking-wider">One-Time Invite Codes</p>
                        {collegeInviteCodes[c.id].map(code => (
                          <div key={code.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                            <span className={`font-mono text-sm font-bold tracking-wider ${code.is_used ? 'text-white/30 line-through' : 'text-amber-400'}`}>
                              {code.code}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${code.is_used ? 'bg-white/10 text-white/40' : 'bg-cyber-green/10 text-cyber-green'}`}>
                              {code.is_used ? 'USED' : 'ACTIVE'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

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

        {tab === 'organiser_requests' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-black">Organiser Applications</h2>
              {roleRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
                  {roleRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {roleRequests.filter(r => r.status === 'pending').map(req => (
                <div key={req.id} className="rounded-2xl border border-amber-500/20 p-5" style={{ background: 'rgba(245,158,11,0.03)' }}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-5 h-5 text-amber-400" />
                        <h3 className="font-bold text-lg">{req.profile?.full_name || req.profile?.email}</h3>
                        {req.profile?.roll_number && (
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                            {req.profile.roll_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/50">
                        <p>{req.profile?.email}</p>
                        <p className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {req.college?.name}</p>
                        <p className="flex items-center gap-1 font-mono text-cyber-green border border-cyber-green/20 bg-cyber-green/5 px-2 py-0.5 rounded">
                          CODE: {req.invite_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleRejectRole(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveRole(req)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-black transition-all disabled:opacity-50"
                        style={{ background: '#00FF66' }}>
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {roleRequests.filter(r => r.status === 'pending').length === 0 && (
                <div className="col-span-full py-12 text-center border border-white/[0.06] rounded-2xl border-dashed">
                  <p className="text-white/40">No pending organiser applications.</p>
                </div>
              )}
            </div>

            {/* History */}
            {roleRequests.filter(r => r.status !== 'pending').length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-white/50 mb-4">Past Applications</h3>
                <div className="space-y-3">
                  {roleRequests.filter(r => r.status !== 'pending').map(req => (
                    <div key={req.id} className="rounded-xl border border-white/[0.06] px-5 py-4 flex items-center justify-between"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div>
                        <p className="font-semibold">{req.profile?.full_name || req.profile?.email}</p>
                        <p className="text-xs text-white/40 mt-0.5">{req.college?.name} · Code: {req.invite_code}</p>
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

        {tab === 'batch_codes' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black">CR Batch Codes</h2>
                <p className="text-sm text-white/50 mt-1">Define valid Roll Number prefixes for Class Representatives (e.g. "2026-CS", "2024-MECH").</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {batchCodes.map(bc => (
                    <div key={bc.id} className="rounded-xl border border-white/[0.06] p-4 flex items-center justify-between group"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <span className="font-mono font-bold text-cyber-green">{bc.batch_prefix}</span>
                      <button
                        onClick={() => handleDeleteBatchCode(bc.id)}
                        disabled={actionLoading === bc.id}
                        className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        {actionLoading === bc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                  {batchCodes.length === 0 && (
                    <div className="col-span-full py-12 text-center border border-white/[0.06] rounded-2xl border-dashed">
                      <p className="text-white/40">No batch codes defined.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 h-fit">
                <h3 className="font-bold mb-4">Add Batch Prefix</h3>
                <form onSubmit={handleAddBatchCode} className="space-y-3">
                  <div>
                    <input
                      required
                      type="text"
                      placeholder="e.g. 2026-CS"
                      value={newBatchPrefix}
                      onChange={e => setNewBatchPrefix(e.target.value)}
                      className="input-cyber w-full"
                    />
                    <p className="text-xs text-white/40 mt-2">Any Roll Number starting with this prefix will be routed to the assigned CR.</p>
                  </div>
                  <button type="submit" disabled={actionLoading === 'add_batch'} className="btn-cyber w-full justify-center">
                    {actionLoading === 'add_batch' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Prefix'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-black">Security Settings</h2>
            </div>
            
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-cyber-green mb-2">Student Roll Number Format</h3>
              <p className="text-sm text-white/40 mb-6 max-w-2xl">
                Define the strict format for roll numbers at your university. When students register, they will be forced to match this pattern exactly. This greatly improves OCR accuracy.
              </p>

              <VisualRegexBuilder 
                initialBlocks={uniRegexBlocks}
                onChange={(regex, hint, blocks) => {
                  setUniRegexStr(regex)
                  setUniRegexHint(hint)
                  setUniRegexBlocks(blocks)
                }}
              />

              <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Generated Pattern</p>
                  <p className="font-mono text-sm text-amber-400">{uniRegexStr || 'No pattern set'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Example Hint</p>
                  <p className="font-mono text-sm text-cyber-green">{uniRegexHint || 'No hint set'}</p>
                </div>
                <button
                  onClick={handleSaveRegex}
                  disabled={actionLoading === 'save_regex' || !uniRegexStr}
                  className="btn-cyber flex items-center gap-2"
                >
                  {actionLoading === 'save_regex' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Format'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
