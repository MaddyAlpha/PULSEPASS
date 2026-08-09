'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, Users, Ticket, TrendingUp, Plus, Settings, Edit3,
  Eye, Calendar, CheckCircle2, Clock, Zap, Mail, Copy, Loader2, X,
  Building2, Search, AlertTriangle, Shield, Scan, UserCheck, ChevronDown, Trash2, UserPlus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Event, Organization, Profile } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Navbar from '@/components/ui/Navbar'

type TabId = 'overview' | 'events' | 'supervisors' | 'create'

interface OrgStats {
  total_events: number
  published_events: number
  total_tickets: number
  total_checkins: number
  checkin_rate: number
}

interface EventWithStats extends Event {
  ticket_count: number
  checkin_count: number
}

export default function OrgDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('overview')
  const [org, setOrg] = useState<Organization | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventWithStats[]>([])
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [stats, setStats] = useState<OrgStats>({ total_events: 0, published_events: 0, total_tickets: 0, total_checkins: 0, checkin_rate: 0 })
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  // Role manager state
  const [roleSearch, setRoleSearch] = useState('')
  const [roleSearchResult, setRoleSearchResult] = useState<any>(null)
  const [roleSearching, setRoleSearching] = useState(false)
  const [roleAssigning, setRoleAssigning] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('supervisor')
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // University join request flow
  const [universities, setUniversities] = useState<{ id: string; name: string; slug: string }[]>([])
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([])
  const [uniPickerStep, setUniPickerStep] = useState<1|2>(1)
  const [selectedUni, setSelectedUni] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [selectedCollege, setSelectedCollege] = useState<{ id: string; name: string } | null>(null)
  const [uniSearch, setUniSearch] = useState('')
  const [collegeSearch, setCollegeSearch] = useState('')
  const [joinRequest, setJoinRequest] = useState<{ status: string; reviewer_note?: string } | null>(null)
  const [submittingRequest, setSubmittingRequest] = useState(false)

  // Event creation form
  const [eventForm, setEventForm] = useState({
    title: '', description: '', venue: '', venue_map_url: '',
    starts_at: '', ends_at: '', general_capacity: 100, vip_capacity: 0,
    tags: '', roll_number_pattern: '', requires_approval: false,
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      if (profileData?.role !== 'org_admin' && profileData?.role !== 'super_admin') {
        router.push('/events')
        return
      }

      // Fetch org
      const { data: orgData } = await supabase
        .from('organizations').select('*').eq('owner_id', user.id).single()
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)

      // Fetch events with ticket/checkin counts
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('org_id', orgData.id)
        .order('created_at', { ascending: false })

      const eventsWithStats: EventWithStats[] = []
      for (const event of eventsData || []) {
        const [{ count: tc }, { count: cc }] = await Promise.all([
          supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', event.id),
          supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('event_id', event.id).eq('success', true),
        ])
        eventsWithStats.push({ ...event, ticket_count: tc || 0, checkin_count: cc || 0 })
      }
      setEvents(eventsWithStats)

      // Fetch supervisors
      const { data: supsData } = await supabase
        .from('org_members_supervisors')
        .select('*, profile:profiles(full_name, email, role)')
        .eq('org_id', orgData.id)
      setSupervisors(supsData || [])

      // Fetch team members (all non-student roles) for role manager
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['supervisor', 'committee_admin', 'org_admin', 'college_admin', 'university_admin'])
        .order('full_name')
      setTeamMembers(teamData || [])

      // Compute stats
      const totalTickets = eventsWithStats.reduce((a, e) => a + e.ticket_count, 0)
      const totalCheckins = eventsWithStats.reduce((a, e) => a + e.checkin_count, 0)
      setStats({
        total_events: eventsWithStats.length,
        published_events: eventsWithStats.filter(e => e.status === 'published').length,
        total_tickets: totalTickets,
        total_checkins: totalCheckins,
        checkin_rate: totalTickets > 0 ? Math.round((totalCheckins / totalTickets) * 100) : 0,
      })

      // Fetch universities for joining
      const { data: unis } = await supabase.from('universities').select('id, name, slug').eq('is_active', true).order('name')
      setUniversities(unis || [])

      // Fetch any existing join request
      const { data: reqData } = await supabase
        .from('org_join_requests')
        .select('status, reviewer_note')
        .eq('org_id', orgData.id)
        .maybeSingle()
      setJoinRequest(reqData || null)

      setLoading(false)
    }
    load()
  }, [])

  const handleSelectUniversity = async (uni: { id: string; name: string; slug: string }) => {
    setSelectedUni(uni)
    setUniPickerStep(2)
    setCollegeSearch('')
    const { data: cols } = await supabase.from('colleges').select('id, name').eq('university_id', uni.id).order('name')
    setColleges(cols || [])
  }

  const handleSubmitJoinRequest = async () => {
    if (!org || !selectedUni) return
    setSubmittingRequest(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')
      const { error } = await supabase.from('org_join_requests').upsert({
        org_id: org.id,
        university_id: selectedUni.id,
        college_id: selectedCollege?.id || null,
        requested_by: user.id,
        status: 'pending',
      }, { onConflict: 'org_id,university_id' })
      if (error) throw error
      setJoinRequest({ status: 'pending' })
      toast.success('Request submitted! Waiting for university approval.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request')
    } finally {
      setSubmittingRequest(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !profile) return
    setCreating(true)
    try {
      const slug = eventForm.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()
      const { error } = await supabase.from('events').insert({
        org_id: org.id,
        title: eventForm.title,
        slug,
        description: eventForm.description,
        venue: eventForm.venue,
        venue_map_url: eventForm.venue_map_url || null,
        starts_at: eventForm.starts_at,
        ends_at: eventForm.ends_at,
        general_capacity: eventForm.general_capacity,
        vip_capacity: eventForm.vip_capacity,
        tags: eventForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        roll_number_pattern: eventForm.roll_number_pattern.trim() || null,
        requires_approval: eventForm.requires_approval,
        status: 'draft',
        created_by: profile.id,
      })
      if (error) throw error
      toast.success('Event created as draft!')
      setShowCreateModal(false)
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  const handlePublishEvent = async (eventId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', eventId)
    if (error) { toast.error(error.message); return }
    toast.success(`Event ${newStatus}!`)
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: newStatus as any } : e))
  }

  const handleInviteSupervisor = async () => {
    if (!org || !inviteEmail) return
    setInviting(true)
    try {
      // Find user by email
      const { data: invitedProfile } = await supabase
        .from('profiles').select('id').eq('email', inviteEmail).single()

      if (!invitedProfile) {
        toast.error('No user with that email found. They must sign up first.')
        setInviting(false)
        return
      }

      const { error } = await supabase.from('org_members_supervisors').insert({
        org_id: org.id,
        user_id: invitedProfile.id,
        member_role: 'supervisor',
        invited_by: profile?.id,
        invite_email: inviteEmail,
        event_scopes: [],
        accepted: true,
      })

      // Update their role
      await supabase.from('profiles').update({ role: 'supervisor' }).eq('id', invitedProfile.id)

      if (error && !error.message.includes('duplicate')) throw error

      toast.success('Supervisor added!')
      setInviteEmail('')
      setShowInviteModal(false)
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite supervisor')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Zap className="w-12 h-12 text-cyber-green mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Organization Found</h2>
          <p className="text-white/50 mb-6">You need an org_admin account with an organization linked.</p>
          <Link href="/org/setup" className="btn-cyber">Setup Organization</Link>
        </div>
      </div>
    )
  }

  const handleSearchRole = async () => {
    if (!roleSearch.trim()) return
    setRoleSearching(true)
    setRoleSearchResult(null)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .ilike('email', roleSearch.trim())
        .maybeSingle()
      setRoleSearchResult(data || 'not_found')
    } catch {
      setRoleSearchResult('not_found')
    } finally {
      setRoleSearching(false)
    }
  }

  const handleAssignRole = async (userId: string, newRole: string) => {
    setRoleAssigning(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
      if (error) throw error

      // Also add to org_members_supervisors if not already there
      if (['supervisor', 'committee_admin'].includes(newRole) && org) {
        await supabase.from('org_members_supervisors').upsert({
          org_id: org.id,
          user_id: userId,
          member_role: newRole,
          invited_by: profile?.id,
          invite_email: roleSearchResult?.email,
          event_scopes: [],
          accepted: true,
        }, { onConflict: 'org_id,user_id' })
      }

      toast.success(`Role assigned: ${ROLE_OPTIONS.find(r => r.value === newRole)?.label}`)
      setRoleSearchResult((prev: any) => ({ ...prev, role: newRole }))
      // Refresh team list
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['supervisor', 'committee_admin', 'org_admin', 'college_admin', 'university_admin'])
        .order('full_name')
      setTeamMembers(teamData || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign role')
    } finally {
      setRoleAssigning(false)
    }
  }

  const handleRemoveRole = async (userId: string) => {
    if (!confirm('Remove this person\'s role? They will become a regular student.')) return
    try {
      await supabase.from('profiles').update({ role: 'student' }).eq('id', userId)
      toast.success('Role removed')
      setTeamMembers(prev => prev.filter(m => m.id !== userId))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const TABS = [
    { id: 'overview' as TabId, label: 'Overview', icon: BarChart3 },
    { id: 'events' as TabId, label: 'Events', icon: Calendar },
    { id: 'roles' as TabId, label: 'Role Manager', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />
      <div className="pt-20 pb-16">
        {/* Header */}
        <div className="border-b border-white/[0.06]"
          style={{ background: 'rgba(15,19,23,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                  <span className="text-xs text-cyber-green font-semibold tracking-wider uppercase">Command Center</span>
                </div>
                <h1 className="text-3xl font-black">{org.name}</h1>
                {org.department && <p className="text-white/40 text-sm mt-1">{org.department}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowInviteModal(true)} className="btn-ghost">
                  <Mail className="w-4 h-4" />
                  Invite Supervisor
                </button>
                <button onClick={() => setShowCreateModal(true)} className="btn-cyber">
                  <Plus className="w-4 h-4" />
                  Create Event
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={tab === t.id ? {
                    background: 'rgba(0,255,102,0.1)',
                    color: '#00FF66',
                    border: '1px solid rgba(0,255,102,0.2)',
                  } : { color: 'rgba(232,237,242,0.4)' }}>
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="space-y-8">
              {/* University Join Request Banner */}
              {!(org as any).university_id && (
                <div className="rounded-2xl border border-amber-500/30 p-6"
                  style={{ background: 'rgba(245,158,11,0.05)' }}>

                  {/* Rejected state */}
                  {joinRequest?.status === 'rejected' && (
                    <div className="mb-5 p-4 rounded-xl border border-red-500/30" style={{ background: 'rgba(255,50,80,0.06)' }}>
                      <p className="font-bold text-red-400 mb-1">Request Rejected</p>
                      <p className="text-sm text-white/50">{joinRequest.reviewer_note || 'Your join request was rejected. You can submit a new one below.'}</p>
                    </div>
                  )}

                  {/* Pending state */}
                  {joinRequest?.status === 'pending' && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)' }}>
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      </div>
                      <div>
                        <p className="font-bold text-purple-400">Awaiting University Approval</p>
                        <p className="text-sm text-white/50 mt-0.5">Your request to join the university has been submitted. You'll be able to create events once approved.</p>
                      </div>
                    </div>
                  )}

                  {/* Request form — shown if no pending request */}
                  {(!joinRequest || joinRequest.status === 'rejected') && (
                    <>
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-bold text-amber-400">Join a University</p>
                          <p className="text-sm text-white/50 mt-1">Search for your university and college below. Your request will be sent to the University Admin for approval.</p>
                        </div>
                      </div>

                      {/* Step 1: Select University */}
                      {uniPickerStep === 1 && (
                        <>
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input placeholder="Search universities..."
                              value={uniSearch} onChange={e => setUniSearch(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {universities.filter(u => u.name.toLowerCase().includes(uniSearch.toLowerCase())).map(uni => (
                              <button key={uni.id} onClick={() => handleSelectUniversity(uni)}
                                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between group">
                                <div>
                                  <p className="font-semibold text-sm">{uni.name}</p>
                                  <p className="text-xs text-white/40">/u/{uni.slug}</p>
                                </div>
                                <Building2 className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
                              </button>
                            ))}
                            {universities.filter(u => u.name.toLowerCase().includes(uniSearch.toLowerCase())).length === 0 && (
                              <p className="text-center text-white/30 text-sm py-4">No universities found.</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Step 2: Select College + Submit */}
                      {uniPickerStep === 2 && selectedUni && (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => { setUniPickerStep(1); setSelectedUni(null); setSelectedCollege(null) }}
                              className="text-xs text-white/40 hover:text-white transition-colors">← Back</button>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <Building2 className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-amber-400 font-semibold">{selectedUni.name}</span>
                            </div>
                          </div>
                          {colleges.length > 0 ? (
                            <>
                              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Select Your College <span className="text-red-400">*</span></p>
                              <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input placeholder="Search colleges..."
                                  value={collegeSearch} onChange={e => setCollegeSearch(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
                              </div>
                              <div className="space-y-2 max-h-36 overflow-y-auto mb-4">
                                {colleges.filter(c => c.name.toLowerCase().includes(collegeSearch.toLowerCase())).map(col => (
                                  <button key={col.id} onClick={() => setSelectedCollege(selectedCollege?.id === col.id ? null : col)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-between ${
                                      selectedCollege?.id === col.id
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                                    }`}>
                                    {col.name}
                                    {selectedCollege?.id === col.id && <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-white/40 mb-4">No colleges added to this university yet. You can still submit your request.</p>
                          )}
                          <button onClick={handleSubmitJoinRequest} disabled={submittingRequest || (colleges.length > 0 && !selectedCollege)}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ background: '#F59E0B', color: '#000' }}>
                            {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                            Submit Join Request
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Linked University Badge */}
              {(org as any).university_id && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-cyber-green/20 w-fit"
                  style={{ background: 'rgba(0,255,102,0.05)' }}>
                  <Building2 className="w-4 h-4 text-cyber-green" />
                  <span className="text-sm text-cyber-green font-semibold">✓ Linked to University</span>
                </div>
              )}
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  { label: 'Total Events', value: stats.total_events, sub: `${stats.published_events} published`, icon: Calendar, color: '#E8EDF2' },
                  { label: 'Tickets Sold', value: stats.total_tickets, sub: 'across all events', icon: Ticket, color: '#00FF66' },
                  { label: 'Check-Ins', value: stats.total_checkins, sub: 'verified entries', icon: CheckCircle2, color: '#00FF66' },
                  { label: 'Check-In Rate', value: `${stats.checkin_rate}%`, sub: 'overall attendance', icon: TrendingUp, color: stats.checkin_rate > 70 ? '#00FF66' : '#FFA500' },
                ].map((s, i) => (
                  <motion.div key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-xs text-white/40 uppercase tracking-wider">{s.label}</p>
                      <s.icon className="w-4 h-4 text-white/20" />
                    </div>
                    <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-white/30">{s.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Recent events mini-table */}
              <div className="glass-card">
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h2 className="font-bold">Recent Events</h2>
                  <button onClick={() => setTab('events')} className="text-xs text-cyber-green hover:underline">View All</button>
                </div>
                {events.slice(0, 5).map(event => {
                  const rate = event.ticket_count > 0
                    ? Math.round((event.checkin_count / event.ticket_count) * 100) : 0
                  return (
                    <div key={event.id} className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <p className="text-xs text-white/35 mt-0.5">
                          {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {event.venue}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-center">
                          <p className="text-sm font-bold text-cyber-green">{event.ticket_count}</p>
                          <p className="text-[10px] text-white/30">tickets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold">{rate}%</p>
                          <p className="text-[10px] text-white/30">check-in</p>
                        </div>
                        <div className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                          style={event.status === 'published' ? {
                            background: 'rgba(0,255,102,0.1)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.2)',
                          } : {
                            background: 'rgba(255,255,255,0.05)', color: 'rgba(232,237,242,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                          {event.status}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {events.length === 0 && (
                  <div className="px-6 py-12 text-center text-white/30 text-sm">
                    No events yet. Create your first event!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events Tab */}
          {tab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl">All Events</h2>
                <button onClick={() => setShowCreateModal(true)} className="btn-cyber">
                  <Plus className="w-4 h-4" /> Create Event
                </button>
              </div>
              {events.map(event => {
                const rate = event.ticket_count > 0
                  ? Math.round((event.checkin_count / event.ticket_count) * 100) : 0
                return (
                  <div key={event.id} className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{event.title}</h3>
                        {event.vip_capacity > 0 && (
                          <span className="badge-vip"><Zap className="w-2.5 h-2.5" /> VIP</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-white/40">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>{event.venue}</span>
                        <span>{event.ticket_count} / {event.general_capacity + event.vip_capacity} tickets</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center px-4">
                        <p className="text-lg font-black text-cyber-green">{rate}%</p>
                        <p className="text-[10px] text-white/30">check-in rate</p>
                      </div>
                      <Link href={`/scanner/${event.id}`} className="btn-ghost text-sm">
                        <Eye className="w-4 h-4" /> Scanner
                      </Link>
                      <button
                        onClick={() => handlePublishEvent(event.id, event.status)}
                        className="text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
                        style={event.status === 'published' ? {
                          background: 'rgba(255,50,80,0.1)', color: '#FF3250', border: '1px solid rgba(255,50,80,0.2)',
                        } : {
                          background: 'rgba(0,255,102,0.1)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.2)',
                        }}>
                        {event.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {events.length === 0 && (
                <div className="text-center py-20">
                  <Calendar className="w-12 h-12 text-white/15 mx-auto mb-4" />
                  <p className="text-white/40">No events yet</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn-cyber mt-4">Create First Event</button>
                </div>
              )}
            </div>
          )}

          {/* Role Manager Tab */}
          {tab === 'roles' && (
            <div className="space-y-8">
              {/* Role Legend */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ROLE_OPTIONS.map(r => (
                  <div key={r.value} className="rounded-2xl p-4 flex items-start gap-4"
                    style={{ background: r.bg, border: `1px solid ${r.border}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: r.bg, border: `1px solid ${r.border}` }}>
                      <r.icon className="w-5 h-5" style={{ color: r.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: r.color }}>{r.label}</p>
                      <p className="text-xs text-white/50 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Search & Assign */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-1">
                  <UserPlus className="w-5 h-5 text-cyber-green" />
                  <h2 className="font-bold text-lg">Assign a Role</h2>
                </div>
                <p className="text-sm text-white/40 mb-5">The person must already have a PulsePass account. Search by their email address.</p>

                <div className="flex gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="volunteer@college.edu"
                      value={roleSearch}
                      onChange={e => setRoleSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchRole()}
                      className="input-cyber w-full pl-10"
                    />
                  </div>
                  <button onClick={handleSearchRole} disabled={roleSearching} className="btn-cyber shrink-0">
                    {roleSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>

                {/* Search result */}
                {roleSearchResult === 'not_found' && (
                  <div className="p-4 rounded-xl border border-red-500/20 text-red-400/80 text-sm"
                    style={{ background: 'rgba(255,50,80,0.05)' }}>
                    No user found with that email. Ask them to sign up at PulsePass first.
                  </div>
                )}

                {roleSearchResult && roleSearchResult !== 'not_found' && (
                  <div className="p-5 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black"
                        style={{ background: 'rgba(0,255,102,0.1)', color: '#00FF66' }}>
                        {roleSearchResult.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold">{roleSearchResult.full_name || 'Unknown'}</p>
                        <p className="text-white/40 text-sm">{roleSearchResult.email}</p>
                        <p className="text-xs mt-1">
                          Current role: <span className="text-cyber-green font-semibold">{roleSearchResult.role || 'student'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Role selector */}
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Assign Role</p>
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {ROLE_OPTIONS.map(r => (
                        <button key={r.value}
                          onClick={() => setSelectedRole(r.value)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                          style={selectedRole === r.value ? {
                            background: r.bg, borderColor: r.border,
                          } : {
                            background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)',
                          }}>
                          <r.icon className="w-4 h-4 shrink-0" style={{ color: selectedRole === r.value ? r.color : 'rgba(255,255,255,0.3)' }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: selectedRole === r.value ? r.color : 'rgba(255,255,255,0.7)' }}>{r.label}</p>
                            <p className="text-xs text-white/30">{r.desc}</p>
                          </div>
                          {selectedRole === r.value && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: r.color }} />}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleAssignRole(roleSearchResult.id, selectedRole)}
                      disabled={roleAssigning}
                      className="w-full py-3 rounded-xl font-bold text-black text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ background: '#00FF66' }}>
                      {roleAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Assign Role
                    </button>
                  </div>
                )}
              </div>

              {/* Current Team */}
              <div className="glass-card">
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <h2 className="font-bold">Current Team ({teamMembers.length})</h2>
                  <p className="text-xs text-white/40 mt-0.5">All users with gate or admin access</p>
                </div>
                {teamMembers.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-white/30">No team members yet. Search above to assign roles.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {teamMembers.map(member => {
                      const roleInfo = ROLE_OPTIONS.find(r => r.value === member.role)
                      return (
                        <div key={member.id} className="px-6 py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                              style={{ background: roleInfo?.bg || 'rgba(255,255,255,0.05)', color: roleInfo?.color || 'rgba(255,255,255,0.5)' }}>
                              {member.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{member.full_name || 'Unknown'}</p>
                              <p className="text-xs text-white/40">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                              style={{ background: roleInfo?.bg || 'rgba(255,255,255,0.05)', color: roleInfo?.color || 'rgba(255,255,255,0.5)', border: `1px solid ${roleInfo?.border || 'rgba(255,255,255,0.1)'}` }}>
                              {roleInfo && <roleInfo.icon className="w-3 h-3" />}
                              {roleInfo?.label || member.role}
                            </div>
                            {/* Quick links based on role */}
                            {(member.role === 'supervisor') && events[0] && (
                              <a href={`/scanner/${events[0].id}`} target="_blank"
                                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                                style={{ background: 'rgba(0,255,102,0.08)', color: '#00FF66', border: '1px solid rgba(0,255,102,0.2)' }}>
                                Scanner Link ↗
                              </a>
                            )}
                            {(member.role === 'committee_admin') && events[0] && (
                              <a href={`/verifier/${events[0].id}`} target="_blank"
                                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                                style={{ background: 'rgba(167,139,250,0.08)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                                Verifier Link ↗
                              </a>
                            )}
                            <button onClick={() => handleRemoveRole(member.id)}
                              className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="font-bold text-xl">Create New Event</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Event Title *</label>
                  <input required placeholder="e.g. Annual Agriculture Festival 2025"
                    value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
                    className="input-cyber w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Description</label>
                  <textarea rows={3} placeholder="Event description..."
                    value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))}
                    className="input-cyber w-full resize-none" />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Venue *</label>
                  <input required placeholder="e.g. Main Auditorium, Block B"
                    value={eventForm.venue} onChange={e => setEventForm(p => ({ ...p, venue: e.target.value }))}
                    className="input-cyber w-full" />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Venue Map URL</label>
                  <input placeholder="Google Maps link"
                    value={eventForm.venue_map_url} onChange={e => setEventForm(p => ({ ...p, venue_map_url: e.target.value }))}
                    className="input-cyber w-full" />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Start Date & Time *</label>
                  <input type="datetime-local" required
                    value={eventForm.starts_at} onChange={e => setEventForm(p => ({ ...p, starts_at: e.target.value }))}
                    className="input-cyber w-full" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">End Date & Time *</label>
                  <input type="datetime-local" required
                    value={eventForm.ends_at} onChange={e => setEventForm(p => ({ ...p, ends_at: e.target.value }))}
                    className="input-cyber w-full" style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">General Capacity</label>
                  <input type="number" min={1}
                    value={eventForm.general_capacity} onChange={e => setEventForm(p => ({ ...p, general_capacity: parseInt(e.target.value) || 0 }))}
                    className="input-cyber w-full" />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">VIP Capacity <span className="text-white/25">(0 = no VIP)</span></label>
                  <input type="number" min={0}
                    value={eventForm.vip_capacity} onChange={e => setEventForm(p => ({ ...p, vip_capacity: parseInt(e.target.value) || 0 }))}
                    className="input-cyber w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Tags <span className="text-white/25">(comma-separated)</span></label>
                  <input placeholder="e.g. agriculture, workshop, networking"
                    value={eventForm.tags} onChange={e => setEventForm(p => ({ ...p, tags: e.target.value }))}
                    className="input-cyber w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Required Roll No Format (Regex)</label>
                  <input placeholder="e.g. ^[A-Z]{3}[0-9]{4}$ (Leave empty for any roll number)"
                    value={eventForm.roll_number_pattern} onChange={e => setEventForm(p => ({ ...p, roll_number_pattern: e.target.value }))}
                    className="input-cyber w-full" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="approval"
                    checked={eventForm.requires_approval}
                    onChange={e => setEventForm(p => ({ ...p, requires_approval: e.target.checked }))}
                    className="w-4 h-4 accent-cyber-green" />
                  <label htmlFor="approval" className="text-sm text-white/70">Requires approval to attend</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-cyber flex-1 justify-center">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Event</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Invite Supervisor Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-xl">Invite Event Supervisor</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-white/50 mb-6">
              The student must already have a PulsePass account. They will be granted gatekeeper access to your events.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Student Email</label>
                <input type="email" placeholder="student@university.edu"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="input-cyber w-full" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowInviteModal(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={handleInviteSupervisor} disabled={inviting || !inviteEmail} className="btn-cyber flex-1 justify-center">
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Invite</>}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
