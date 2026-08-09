'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Eye, EyeOff, Mail, Lock, User, Building2, GraduationCap, ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Tab = 'signin' | 'signup'
type Role = 'student' | 'org_admin'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'signin')
  const [role, setRole] = useState<Role>((searchParams.get('role') as Role) || 'student')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    org_name: '',
    org_department: '',
    verification_code: '',
  })

  const update = (key: string, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }))

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
      if (error) throw error

      toast.success('Welcome back!')
      const redirect = searchParams.get('redirect') || '/events'
      window.location.href = redirect
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.full_name) {
      toast.error('Please fill in all required fields')
      return
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (role === 'org_admin' && !formData.org_name) {
      toast.error('Organization name is required')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role,
            org_name: formData.org_name || null,
            org_department: formData.org_department || null,
          },
        },
      })
      if (error) throw error

      if (role === 'org_admin' && data.user) {
        // Create org record
        const slug = formData.org_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        await supabase.from('organizations').insert({
          name: formData.org_name,
          slug: `${slug}-${Date.now()}`,
          department: formData.org_department || null,
          owner_id: data.user.id,
        })
        // Update role
        await supabase.from('profiles').update({ role: 'org_admin' }).eq('id', data.user.id)
      }

      if (data.session) {
        toast.success('Account created successfully!')
        const redirect = searchParams.get('redirect') || '/events'
        window.location.href = redirect
      } else {
        toast.success('Account created successfully! Please sign in.')
        setTab('signin')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-obsidian-900 cyber-grid flex flex-col p-4 py-8 overflow-y-auto"
      style={{ backgroundSize: '40px 40px' }}>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(0,255,102,0.07) 0%, transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-md mx-auto my-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00FF66, #00B846)' }}>
              <Zap className="w-5 h-5 text-obsidian-900" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black tracking-tight">
              Pulse<span className="text-cyber-green">Pass</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card p-8">

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden mb-8"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['signin', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200"
                style={tab === t ? {
                  background: 'linear-gradient(135deg, rgba(0,255,102,0.15), rgba(0,255,102,0.08))',
                  color: '#00FF66',
                  borderRadius: '10px',
                  margin: '3px',
                } : { color: 'rgba(232,237,242,0.4)' }}>
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'signin' ? (
              <motion.form
                key="signin"
                initial={{ x: -10 }}
                animate={{ x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignIn}
                className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="you@university.edu"
                      value={formData.email}
                      onChange={e => update('email', e.target.value)}
                      className="input-cyber pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => update('password', e.target.value)}
                      className="input-cyber pl-10 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-cyber w-full justify-center py-3.5 mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </button>

                <p className="text-center text-xs text-white/40">
                  No account?{' '}
                  <button type="button" onClick={() => setTab('signup')} className="text-cyber-green hover:underline">
                    Create one free
                  </button>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ x: 10 }}
                animate={{ x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignUp}
                className="space-y-4">

                {/* Role selector */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">I am a</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: 'student', label: 'Student', icon: GraduationCap, desc: 'Claim passes & attend events' },
                      { id: 'org_admin', label: 'Club / Org', icon: Building2, desc: 'Manage events & tickets' },
                    ] as { id: Role; label: string; icon: typeof GraduationCap; desc: string }[]).map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200 text-center"
                        style={role === r.id ? {
                          background: 'rgba(0,255,102,0.08)',
                          border: '1px solid rgba(0,255,102,0.3)',
                        } : {
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                        <r.icon className={`w-5 h-5 ${role === r.id ? 'text-cyber-green' : 'text-white/40'}`} />
                        <div>
                          <p className={`text-sm font-semibold ${role === r.id ? 'text-cyber-green' : 'text-white/70'}`}>
                            {r.label}
                          </p>
                          <p className="text-xs text-white/35 mt-0.5">{r.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="Your full name"
                      value={formData.full_name}
                      onChange={e => update('full_name', e.target.value)}
                      className="input-cyber pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    University Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="you@university.edu"
                      value={formData.email}
                      onChange={e => update('email', e.target.value)}
                      className="input-cyber pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 8 characters"
                      value={formData.password}
                      onChange={e => update('password', e.target.value)}
                      className="input-cyber pl-10 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Org-specific fields */}
                <AnimatePresence>
                  {role === 'org_admin' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden">
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                          Organization / Club Name
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                          <input
                            type="text"
                            required={role === 'org_admin'}
                            placeholder="e.g. Agro Club, COBS Society"
                            value={formData.org_name}
                            onChange={e => update('org_name', e.target.value)}
                            className="input-cyber pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                          Department <span className="text-white/25">(optional)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Faculty of Agriculture"
                          value={formData.org_department}
                          onChange={e => update('org_department', e.target.value)}
                          className="input-cyber"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={loading} className="btn-cyber w-full justify-center py-3.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </button>

                <p className="text-center text-xs text-white/40">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setTab('signin')} className="text-cyber-green hover:underline">
                    Sign in
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  )
}
