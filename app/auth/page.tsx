'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Eye, EyeOff, Mail, Lock, User, Building2, ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import DynamicRollNumberInput from '@/components/ui/DynamicRollNumberInput'
import type { RegexBlock } from '@/components/ui/VisualRegexBuilder'

type Tab = 'signin' | 'signup'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'signin')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [universities, setUniversities] = useState<{ id: string, name: string, roll_number_regex: string | null, roll_number_format_hint: string | null, roll_number_regex_blocks: any }[]>([])
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...')
  
  useEffect(() => {
    const fetchUniversities = async () => {
      setDebugInfo('Fetching universities...')
      try {
        const { data, error } = await supabase.from('universities').select('id, name, roll_number_regex, roll_number_format_hint, roll_number_regex_blocks').eq('is_active', true)
        console.log('[PulsePass] Universities fetch result:', { data, error, count: data?.length })
        if (error) {
          console.error('[PulsePass] Universities fetch ERROR:', error.message, error.code, error.details)
          setDebugInfo(`Error: ${error.message}`)
          toast.error(`Error loading universities: ${error.message}`)
        }
        if (data) {
          setUniversities(data)
          setDebugInfo(`Loaded ${data.length} universities`)
        }
      } catch (err: any) {
        setDebugInfo(`Catch Error: ${err.message}`)
      }
    }
    fetchUniversities()
  }, [])

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    university_id: '',
    roll_number: '',
    invite_code: '',
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
      window.location.href = searchParams.get('redirect') || '/my-passes'
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
    if (!isStaff) {
      if (!formData.university_id) {
        toast.error('Please select your university')
        return
      }
      if (!formData.roll_number) {
        toast.error('Roll Number is required')
        return
      }
      // Enforce university-specific roll number regex
      const selectedUni = universities.find(u => u.id === formData.university_id)
      if (selectedUni?.roll_number_regex) {
        const regex = new RegExp(selectedUni.roll_number_regex)
        if (!regex.test(formData.roll_number)) {
          toast.error(`Invalid Roll Number format. Expected format: ${selectedUni.roll_number_regex}`)
          return
        }
      }
    } else {
      if (!formData.invite_code) {
        toast.error('Invite Code is required for staff/admin registration')
        return
      }
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: 'student',
            university_id_fk: formData.university_id || null,
            roll_number: formData.roll_number || null,
            invite_code: formData.invite_code || null,
          },
        },
      })
      if (error) throw error

      if (data.session) {
        toast.success('Account created successfully!')
        window.location.href = '/my-passes'
      } else {
        toast.success('Account created! Please sign in.')
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

                {/* Student-only notice or Staff notice */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-cyber-green/20 cursor-pointer hover:bg-cyber-green/5 transition-colors"
                  style={{ background: 'rgba(0,255,102,0.05)' }}
                  onClick={() => setIsStaff(!isStaff)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,255,102,0.12)' }}>
                    <User className="w-4 h-4 text-cyber-green" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-cyber-green">{isStaff ? 'Staff/Admin Registration' : 'Student Registration'}</p>
                    <p className="text-xs text-white/40 mt-0.5">{isStaff ? 'Registering with an invite code.' : 'Organisers & staff join via invite code.'}</p>
                  </div>
                  <div className="text-xs font-bold text-cyber-green underline decoration-cyber-green/30 hover:decoration-cyber-green/70">
                    Switch to {isStaff ? 'Student' : 'Staff'}
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

                {/* University & Roll Number (for students) OR Invite Code (for staff) */}
                {!isStaff ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50 font-medium uppercase tracking-wider flex justify-between">
                        <span>University</span>
                        <span className="text-amber-500/50">{debugInfo}</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <select
                          required
                          value={formData.university_id}
                          onChange={e => update('university_id', e.target.value)}
                          className="input-cyber pl-10 appearance-none bg-obsidian-900 text-white"
                        >
                          <option value="" className="text-white bg-obsidian-900">Select your university</option>
                          {universities.map(u => (
                            <option key={u.id} value={u.id} className="text-white bg-obsidian-900">{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center justify-between">
                        <span>Roll Number</span>
                        {universities.find(u => u.id === formData.university_id)?.roll_number_format_hint && (
                          <span className="text-cyber-green/70 normal-case font-mono text-[10px]">
                            Format: {universities.find(u => u.id === formData.university_id)?.roll_number_format_hint}
                          </span>
                        )}
                      </label>
                      
                      {(() => {
                        const uni = universities.find(u => u.id === formData.university_id)
                        const blocks = uni?.roll_number_regex_blocks as RegexBlock[] | undefined
                        
                        if (blocks && Array.isArray(blocks) && blocks.length > 0) {
                          return (
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <DynamicRollNumberInput 
                                blocks={blocks} 
                                value={formData.roll_number} 
                                onChange={(val) => update('roll_number', val)} 
                              />
                            </div>
                          )
                        }

                        return (
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                            <input
                              type="text"
                              required
                              placeholder="Your university roll number"
                              value={formData.roll_number}
                              onChange={e => update('roll_number', e.target.value.toUpperCase())}
                              className="input-cyber pl-10 uppercase"
                            />
                          </div>
                        )
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Invite Code</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/50 pointer-events-none" />
                      <input
                        type="text"
                        required
                        placeholder="Enter your admin/staff code"
                        value={formData.invite_code}
                        onChange={e => update('invite_code', e.target.value.toUpperCase())}
                        className="input-cyber pl-10 uppercase focus:border-amber-500/50 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>
                )}

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
      <div className="min-h-[100dvh] bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  )
}
