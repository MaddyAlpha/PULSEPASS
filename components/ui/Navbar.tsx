'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Zap, LayoutDashboard, Ticket, Calendar, Scan, LogOut, Menu, X, User, Shield, GraduationCap, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV_LINKS = [
  { href: '/events', label: 'Events', icon: Calendar, roles: ['all'] },
  { href: '/my-passes', label: 'My Passes', icon: Ticket, roles: ['student', 'supervisor'] },
  { href: '/org/dashboard', label: 'Org Dashboard', icon: LayoutDashboard, roles: ['org_admin', 'super_admin'] },
  { href: '/college-admin', label: 'College Portal', icon: GraduationCap, roles: ['college_admin', 'super_admin'] },
  { href: '/university-admin', label: 'University Portal', icon: GraduationCap, roles: ['university_admin', 'super_admin'] },
  { href: '/super-admin', label: 'Super Admin', icon: Shield, roles: ['super_admin'] },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const visibleLinks = NAV_LINKS.filter(link =>
    link.roles.includes('all') ||
    (profile && link.roles.includes(profile.role))
  )

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06]"
      style={{ background: 'rgba(10,13,15,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00FF66, #00B846)' }}>
            <Zap className="w-4 h-4 text-obsidian-900" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold">Pulse<span className="text-cyber-green">Pass</span></span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={pathname.startsWith(link.href) ? {
                background: 'rgba(0,255,102,0.08)',
                color: '#00FF66',
                border: '1px solid rgba(0,255,102,0.15)',
              } : {
                color: 'rgba(232,237,242,0.55)',
              }}>
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {profile ? (
            <div className="flex items-center gap-3">
              {profile.role === 'supervisor' && (
                <Link href="/scanner" className="btn-cyber text-sm py-2 px-3">
                  <Scan className="w-4 h-4" />
                  Scanner
                </Link>
              )}
              {profile.role === 'committee_admin' && (
                <Link href="/verifier" className="text-sm py-2 px-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
                  style={{ background: '#A78BFA', color: '#000' }}>
                  <UserCheck className="w-4 h-4" />
                  Verifier
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(0,255,102,0.15)', color: '#00FF66' }}>
                  {profile.full_name?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white/80 leading-none">
                    {profile.full_name || profile.email}
                  </span>
                  <span className="text-[10px] text-cyber-green/70 capitalize leading-none mt-0.5">
                    {profile.role.replace('_', ' ')}
                  </span>
                </div>
              </Link>
              <button onClick={handleSignOut} className="btn-ghost py-2 px-3">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth" className="btn-ghost text-sm">Sign In</Link>
              <Link href="/auth?tab=signup" className="btn-cyber text-sm">Get Started</Link>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] px-6 py-4 space-y-1"
          style={{ background: 'rgba(10,13,15,0.97)' }}>
          {visibleLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
              style={pathname.startsWith(link.href) ? {
                background: 'rgba(0,255,102,0.08)',
                color: '#00FF66',
                border: '1px solid rgba(0,255,102,0.15)',
              } : { color: 'rgba(232,237,242,0.6)' }}>
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
          {profile ? (
            <>
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200" style={{ color: 'rgba(232,237,242,0.6)' }}>
                <User className="w-4 h-4" />
                Profile
              </Link>
              <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/50 w-full">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/auth" onClick={() => setMobileOpen(false)} className="btn-cyber w-full justify-center mt-2">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
