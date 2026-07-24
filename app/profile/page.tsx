'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, LogOut, Mail, GraduationCap, Building2, Shield, Loader2, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/lib/types'
import Navbar from '@/components/ui/Navbar'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)

      if (profileData?.role === 'org_admin' || profileData?.role === 'super_admin') {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_id', user.id)
          .single()
        if (orgData) setOrg(orgData)
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
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

      <div className="pt-24 pb-16 max-w-2xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 relative overflow-hidden">
          
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, rgba(0,255,102,0.1) 0%, transparent 70%)' }} />

          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black mb-4"
              style={{ background: 'rgba(0,255,102,0.1)', color: '#00FF66', border: '2px solid rgba(0,255,102,0.2)' }}>
              {profile.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <h1 className="text-2xl font-black text-center">{profile.full_name}</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-xs font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <RoleIcon className="w-3.5 h-3.5" />
              {profile.role.replace('_', ' ')}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Email Address</p>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/40" />
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>

            {profile.university_id && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">University ID</p>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-white/40" />
                  <p className="font-medium">{profile.university_id}</p>
                </div>
              </div>
            )}

            {org && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(0,255,102,0.05)', border: '1px solid rgba(0,255,102,0.1)' }}>
                <p className="text-xs text-cyber-green uppercase tracking-wider mb-1">Organization</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyber-green" />
                    <p className="font-medium">{org.name}</p>
                  </div>
                  <span className="text-xs text-white/40">{org.department}</span>
                </div>
              </div>
            )}
            
            <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Joined</p>
                <p className="font-medium text-sm text-white/70">
                  {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.06] flex justify-center">
            <button 
              onClick={handleSignOut}
              className="btn-ghost flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
