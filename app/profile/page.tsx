'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, LogOut, Mail, GraduationCap, Building2, Shield, 
  Loader2, Zap, Hash, Calendar, Users, KeyRound, ArrowRight,
  UploadCloud, Lock, CheckCircle2, Image as ImageIcon, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { requestOrganiserAccess, joinCommittee } from '@/app/actions/profile'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [university, setUniversity] = useState<{ name: string; slug: string } | null>(null)
  const [college, setCollege] = useState<{ name: string } | null>(null)
  const [myCommittees, setMyCommittees] = useState<{ id: string; name: string; join_code: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  // Committee form state
  const [joinCode, setJoinCode] = useState('')
  const [joiningCommittee, setJoiningCommittee] = useState(false)

  // ID Upload state
  const [uploadingId, setUploadingId] = useState(false)

  // Organiser Request Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [requestingRole, setRequestingRole] = useState(false)

  useEffect(() => {
    loadProfileData()
  }, [])

  const loadProfileData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth')
      return
    }

    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    setProfile(profileData)

    // 2. Fetch University & College Scope
    if (profileData?.university_id_fk) {
      const { data: uniData } = await supabase.from('universities').select('name, slug').eq('id', profileData.university_id_fk).single()
      setUniversity(uniData || null)
    }
    if (profileData?.college_id) {
      const { data: colData } = await supabase.from('colleges').select('name').eq('id', profileData.college_id).single()
      setCollege(colData || null)
    }

    // 3. Fetch Joined Committees (using new committee_members junction)
    const { data: members } = await supabase
      .from('committee_members')
      .select('committee_id, committees(id, name, join_code)')
      .eq('user_id', user.id)
    
    if (members) {
      const comms = members.map(m => m.committees).filter(Boolean) as any[]
      setMyCommittees(comms)
    } else if (profileData?.committee_id) {
      // Fallback to legacy committee_id if table is empty
      const { data: legacyCom } = await supabase.from('committees').select('id, name, join_code').eq('id', profileData.committee_id)
      setMyCommittees(legacyCom || [])
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleJoinCommittee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !joinCode.trim()) return
    setJoiningCommittee(true)
    
    const res = await joinCommittee(joinCode.trim(), profile.id)
    if (res.success) {
      toast.success(res.message || 'Success!')
      setJoinCode('')
      loadProfileData() // Refresh list
    } else {
      toast.error(res.error || 'Failed to join committee')
    }
    setJoiningCommittee(false)
  }

  const handleOrganiserRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setRequestingRole(true)
    
    // We pass profile.university_id_fk or empty string so the server can handle it
    const res = await requestOrganiserAccess(inviteCode.trim(), profile.id, profile.university_id_fk || '')
    if (res.success) {
      toast.success('Application submitted to University Admin for final review.')
      setIsModalOpen(false)
      setInviteCode('')
    } else {
      toast.error(res.error)
    }
    setRequestingRole(false)
  }

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !profile) return
    const file = e.target.files[0]
    setUploadingId(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}/id-card-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('student-ids')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('student-ids').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ id_card_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, id_card_url: publicUrl })
      toast.success('Physical ID successfully verified & saved!')
    } catch (err: any) {
      toast.error(err.message || 'Error uploading ID')
    } finally {
      setUploadingId(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  const getRoleIcon = () => {
    switch (profile.role) {
      case 'student': return GraduationCap
      case 'org_admin': return Building2
      case 'supervisor': return Shield
      case 'super_admin': return Zap
      default: return User
    }
  }

  const RoleIcon = getRoleIcon()

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />

      <div className="pt-24 pb-20 max-w-3xl mx-auto px-6">
        {/* =========================================
            SECTION 1: User Header & Scope Badge
            ========================================= */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-10 relative">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black mb-4 relative z-10"
            style={{ background: 'rgba(0,255,102,0.1)', color: '#00FF66', border: '2px solid rgba(0,255,102,0.2)' }}>
            {profile.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <h1 className="text-3xl font-black text-center mb-2">{profile.full_name}</h1>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
              <RoleIcon className="w-3.5 h-3.5" /> {profile.role.replace('_', ' ')}
            </span>
            {university && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Building2 className="w-3.5 h-3.5" /> {university.name}
              </span>
            )}
            {college && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <GraduationCap className="w-3.5 h-3.5" /> {college.name}
              </span>
            )}
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* =========================================
              SECTION 2: Verified Academic Identity Card
              ========================================= */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-6 rounded-2xl border border-white/[0.08]">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyber-green" /> Digital Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 uppercase font-semibold mb-1 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type="text" readOnly value={profile.email} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-medium text-white/70 cursor-not-allowed focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase font-semibold mb-1 flex justify-between items-center">
                  <span>Roll Number</span>
                  <span className="text-[10px] text-cyber-green/50 flex items-center gap-1"><Lock className="w-3 h-3" /> VERIFIED</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type="text" readOnly value={profile.roll_number || 'Not Set'} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-sm font-mono font-bold text-cyber-green cursor-not-allowed focus:outline-none" />
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-green/30" />
                </div>
              </div>
              <p className="text-xs text-white/30 pt-2">Account Created: {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          </motion.div>

          {/* =========================================
              SECTION 3: Physical ID Vault
              ========================================= */}
          {profile.role === 'student' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card p-6 rounded-2xl border border-white/[0.08]">
              <h2 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" /> Physical ID Vault
              </h2>
              
              {!profile.id_card_url ? (
                // State A: No ID Uploaded
                <div className="relative">
                  <input type="file" accept="image/*" onChange={handleIdUpload} disabled={uploadingId} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-full border-2 border-dashed border-white/20 rounded-xl p-8 text-center bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex flex-col items-center justify-center gap-3">
                    {uploadingId ? (
                      <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-white/40" />
                        <div>
                          <p className="font-semibold text-sm">Upload College ID</p>
                          <p className="text-xs text-white/40 mt-1">Drag & drop or tap to select photo</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                // State B: ID Uploaded
                <div className="space-y-4">
                  <div className="relative w-full aspect-[1.6] rounded-xl overflow-hidden border border-cyber-green/30 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.id_card_url} alt="ID Card" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
                      <div className="bg-cyber-green text-black px-4 py-2 rounded-lg font-bold text-sm pointer-events-auto cursor-pointer relative overflow-hidden">
                        <input type="file" accept="image/*" onChange={handleIdUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        Replace Photo
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-cyber-green/10 border border-cyber-green/20 p-3 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-cyber-green" />
                    <span className="text-sm font-semibold text-cyber-green">Verified Base ID</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* =========================================
              SECTION 4: Role Elevation Trigger
              ========================================= */}
          {profile.role !== 'organiser' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass-card p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-amber-400">Want to organize events?</h3>
                <p className="text-xs text-white/50 mt-1">Get a College Admin invite code to unlock organiser tools.</p>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors shrink-0">
                Apply for Organiser Status
              </button>
            </motion.div>
          )}

          {/* =========================================
              SECTION 5: My Committees Engine
              ========================================= */}
          {profile.role === 'student' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="glass-card p-6 rounded-2xl border border-white/[0.08]">
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> My Committees
              </h2>
              
              {myCommittees.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {myCommittees.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <span className="text-sm font-bold">{c.name}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-1 bg-purple-500/20 text-purple-300 rounded-md">Member</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border border-dashed border-white/10 rounded-xl mb-4 text-center text-xs text-white/40">
                  Not a member of any committee yet.
                </div>
              )}

              <form onSubmit={handleJoinCommittee} className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Enter 4-digit join code"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="input-cyber pl-10 w-full text-sm"
                  />
                </div>
                <button type="submit" disabled={joiningCommittee || !joinCode} className="btn-cyber px-5 shrink-0">
                  {joiningCommittee ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </motion.div>
          )}
        </div>

        <div className="mt-12 flex justify-center">
          <button onClick={handleSignOut} className="btn-ghost flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* =========================================
          ROLE ELEVATION MODAL
          ========================================= */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} 
              className="relative w-full max-w-md bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl p-6">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold mb-2">Apply for Organiser Status</h2>
              <p className="text-sm text-white/50 mb-6">Enter the 6-digit invite code provided by your College Admin to verify your role.</p>
              
              <form onSubmit={handleOrganiserRequest}>
                <div className="relative mb-6">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input type="text" required placeholder="Enter Code (e.g. A1B2C3)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-base font-mono focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all" />
                </div>
                <button type="submit" disabled={requestingRole || !inviteCode} className="w-full py-3.5 rounded-xl font-bold text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: '#F59E0B' }}>
                  {requestingRole ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
