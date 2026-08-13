'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Building2, CheckCircle2, XCircle, Loader2,
  RefreshCw, LogOut, Clock, GraduationCap, Users, Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import VisualRegexBuilder, { RegexBlock } from '@/components/ui/VisualRegexBuilder'
import CollegeRegexSpecializer from '@/components/ui/CollegeRegexSpecializer'

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

type InviteCode = {
  id: string
  code: string
  is_used: boolean
  created_at: string
}

type Organization = {
  id: string
  name: string
  slug: string
  description: string | null
  department: string | null
}

export default function CollegeAdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [collegeName, setCollegeName] = useState('')
  const [collegeId, setCollegeId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState<{ id: string; note: string } | null>(null)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])

  const [tab, setTab] = useState<'requests' | 'organizations' | 'invite_codes' | 'security'>('requests')

  // Security / Regex state
  const [colRegexBlocks, setColRegexBlocks] = useState<RegexBlock[]>([])
  const [colRegexStr, setColRegexStr] = useState('')
  const [colRegexHint, setColRegexHint] = useState('')
  const [uniRegexBlocks, setUniRegexBlocks] = useState<RegexBlock[] | null>(null)

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile || !['college_admin', 'super_admin'].includes(profile.role)) {
      router.push('/auth')
      return
    }

    if (profile.college_id) {
      setCollegeId(profile.college_id)
      const { data: col } = await supabase.from('colleges').select('university_id, name, roll_number_regex, roll_number_format_hint, roll_number_regex_blocks').eq('id', profile.college_id).single()
      setCollegeName(col?.name || 'Your College')
      
      let parsedColBlocks = col?.roll_number_regex_blocks
      if (typeof parsedColBlocks === 'string') {
        try { parsedColBlocks = JSON.parse(parsedColBlocks) } catch (e) {}
      }
      if (parsedColBlocks && Array.isArray(parsedColBlocks)) setColRegexBlocks(parsedColBlocks as unknown as RegexBlock[])
      
      if (col?.roll_number_regex) setColRegexStr(col.roll_number_regex)
      if (col?.roll_number_format_hint) setColRegexHint(col.roll_number_format_hint)

      if (col?.university_id) {
        const { data: uni } = await supabase.from('universities').select('roll_number_regex_blocks').eq('id', col.university_id).single()
        let parsedUniBlocks = uni?.roll_number_regex_blocks
        if (typeof parsedUniBlocks === 'string') {
          try { parsedUniBlocks = JSON.parse(parsedUniBlocks) } catch (e) {}
        }
        if (parsedUniBlocks && Array.isArray(parsedUniBlocks) && parsedUniBlocks.length > 0) {
          setUniRegexBlocks(parsedUniBlocks as unknown as RegexBlock[])
        }
      }
    }

    // Fetch join requests for this college
    let query = supabase
      .from('org_join_requests')
      .select(`
        id, org_id, university_id, college_id, status, created_at,
        org:organizations(name, slug, description),
        college:colleges(name)
      `)
      .order('created_at', { ascending: false })

    if (profile.role === 'college_admin' && profile.college_id) {
      query = query.eq('college_id', profile.college_id)
      
      // Fetch organizations linked to this college
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, slug, description, department')
        .eq('college_id', profile.college_id)
        .order('name')
      setOrganizations(orgs || [])

      // Fetch invite codes
      const { data: codes } = await supabase
        .from('admin_invite_codes')
        .select('id, code, is_used, created_at')
        .eq('college_id', profile.college_id)
        .eq('role', 'organiser')
        .order('created_at', { ascending: false })
      setInviteCodes((codes as any[]) || [])
    }

    const { data } = await query
    setRequests((data as unknown as JoinRequest[]) || [])
    setLoading(false)
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

      // 2. Update the organization to link university & college
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ university_id: req.university_id, college_id: req.college_id || null })
        .eq('id', req.org_id)
      if (orgError) throw orgError

      // 3. Update org owner's profile
      const { data: org } = await supabase.from('organizations').select('owner_id').eq('id', req.org_id).single()
      if (org) {
        await supabase.from('profiles').update({ university_id_fk: req.university_id, college_id: req.college_id || null }).eq('id', org.owner_id)
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

  const handleRemoveOrganization = async (orgId: string) => {
    if (!confirm('Are you sure you want to remove this organization from your college?')) return
    
    setActionLoading(orgId)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ college_id: null })
        .eq('id', orgId)
      if (error) throw error
      
      toast.success('Organization removed from college.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove organization')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateInviteCode = async () => {
    if (!collegeId) {
      toast.error('You must be assigned to a specific College to generate codes.')
      return
    }
    setActionLoading('generate_code')
    try {
      // Get the university_id from the college record, not the profile
      const { data: col } = await supabase.from('colleges').select('university_id').eq('id', collegeId).single()
      if (!col?.university_id) throw new Error('University ID not found for this college')

      // Generate a random 6 character code (alphanumeric)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const { error } = await supabase
        .from('admin_invite_codes')
        .insert({
          college_id: collegeId,
          university_id: col.university_id,
          code,
          role: 'organiser',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
      
      if (error) throw error
      toast.success('Invite code generated successfully!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate code')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCode = async (id: string) => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('admin_invite_codes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      toast.success('Code deleted.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete code')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveRegex = async () => {
    if (!collegeId) return
    setActionLoading('save_regex')
    try {
      const { data, error } = await supabase.from('colleges').update({
        roll_number_regex: colRegexStr,
        roll_number_format_hint: colRegexHint,
        roll_number_regex_blocks: colRegexBlocks
      }).eq('id', collegeId).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Database rejected the update. You may not have permission to modify this college.')
      toast.success('Roll Number format saved for this college!')
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
              <p className="font-black text-sm text-cyber-green uppercase tracking-wider">College Portal</p>
              <p className="text-white/40 text-xs">{collegeName}</p>
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
          <button onClick={() => setTab('organizations')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'organizations' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Active Organizations
          </button>
          <button onClick={() => setTab('invite_codes')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'invite_codes' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Invite Codes
          </button>
          <button onClick={() => setTab('security')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'security' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'text-white/40 hover:bg-white/5'}`}>
            Security
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

        {tab === 'organizations' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black">Active Organizations</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {organizations.map(org => (
                <div key={org.id} className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{org.name}</h3>
                      <p className="text-sm text-white/40 font-mono mt-0.5">@{org.slug}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                      <Users className="w-5 h-5 text-white/50" />
                    </div>
                  </div>
                  
                  {org.description && (
                    <p className="text-sm text-white/60 mb-4 line-clamp-2">{org.description}</p>
                  )}
                  
                  <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                    <button
                      onClick={() => handleRemoveOrganization(org.id)}
                      disabled={actionLoading === org.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all flex items-center gap-2">
                      {actionLoading === org.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Remove from College
                    </button>
                  </div>
                </div>
              ))}
              {organizations.length === 0 && (
                <div className="col-span-full py-12 text-center border border-white/[0.06] rounded-2xl border-dashed">
                  <p className="text-white/40">No organizations linked to this college yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'invite_codes' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black">Organiser Invite Codes</h2>
                <p className="text-sm text-white/50 mt-1">Generate access codes for students to apply for organiser roles.</p>
              </div>
              <button
                onClick={handleGenerateInviteCode}
                disabled={actionLoading === 'generate_code'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-black transition-all disabled:opacity-50"
                style={{ background: '#00FF66' }}>
                {actionLoading === 'generate_code' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate New Code
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inviteCodes.map(code => (
                <div key={code.id} className="p-4 rounded-xl border border-white/5 flex items-center justify-between"
                  style={{ background: !code.is_used ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)' }}>
                  <div>
                    <p className={`font-mono text-xl tracking-wider font-bold ${!code.is_used ? 'text-white' : 'text-white/30 line-through'}`}>{code.code}</p>
                    <p className="text-xs text-white/40 mt-1">Generated: {new Date(code.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${!code.is_used ? 'bg-cyber-green/10 text-cyber-green border-cyber-green/30' : 'bg-white/5 text-white/30 border-white/10'}`}>
                      {!code.is_used ? 'ACTIVE' : 'USED'}
                    </span>
                    <button
                      onClick={() => handleDeleteCode(code.id)}
                      disabled={actionLoading === code.id}
                      className="p-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-red-400 transition-all disabled:opacity-50">
                      {actionLoading === code.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {inviteCodes.length === 0 && (
                <div className="col-span-full py-12 text-center border border-white/[0.06] rounded-2xl border-dashed">
                  <p className="text-white/40">No invite codes generated yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-black">Security Settings</h2>
            </div>
            
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-cyber-green mb-2">College Specific Roll Number Format</h3>
              <p className="text-sm text-white/40 mb-6 max-w-2xl">
                {uniRegexBlocks 
                  ? "Your university has defined a master format. You can lock specific parts of it (like your department code) to strictly enforce them for your college." 
                  : "Define a strict format for roll numbers at your specific college. When students try to join your college or its committees, they will be forced to match this pattern exactly."}
              </p>

              {uniRegexBlocks ? (
                <CollegeRegexSpecializer
                  universityBlocks={uniRegexBlocks}
                  initialCollegeBlocks={colRegexBlocks.length > 0 ? colRegexBlocks : undefined}
                  onChange={(regex, hint, blocks) => {
                    setColRegexStr(regex)
                    setColRegexHint(hint)
                    setColRegexBlocks(blocks)
                  }}
                />
              ) : (
                <VisualRegexBuilder 
                  initialBlocks={colRegexBlocks}
                  onChange={(regex, hint, blocks) => {
                    setColRegexStr(regex)
                    setColRegexHint(hint)
                    setColRegexBlocks(blocks)
                  }}
                />
              )}

              <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Generated Pattern</p>
                  <p className="font-mono text-sm text-amber-400">{colRegexStr || 'No pattern set'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Example Hint</p>
                  <p className="font-mono text-sm text-cyber-green">{colRegexHint || 'No hint set'}</p>
                </div>
                <button
                  onClick={handleSaveRegex}
                  disabled={actionLoading === 'save_regex' || !colRegexStr}
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
