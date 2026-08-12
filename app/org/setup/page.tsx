'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Plus, Zap, Loader2, Search, CheckCircle2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

type University = { id: string; name: string; slug: string }

export default function OrgSetupWizard() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  
  const [universities, setUniversities] = useState<University[]>([])
  const [search, setSearch] = useState('')
  const [selectedUni, setSelectedUni] = useState<University | null>(null)
  
  const [orgForm, setOrgForm] = useState({ name: '', department: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

  // Fetch universities & check if user already has an org
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Check if they already own an org
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (existingOrg) {
        router.push('/org/dashboard')
        return
      }

      // Load active universities
      const { data: unis } = await supabase
        .from('universities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name')
      
      setUniversities(unis || [])

      // Check if user already has a university assigned
      const { data: profile } = await supabase.from('profiles').select('university_id_fk').eq('id', user.id).single()
      if (profile?.university_id_fk) {
        const userUni = (unis || []).find(u => u.id === profile.university_id_fk)
        if (userUni) {
          setSelectedUni(userUni)
          setStep(2)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  const filteredUnis = universities.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUni) return toast.error('Please select a university first')
    if (!orgForm.name.trim()) return toast.error('Organization name is required')

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const slug = orgForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString().slice(-4)

      const { data: profile } = await supabase.from('profiles').select('university_id_fk').eq('id', user.id).single()
      const targetUniId = profile?.university_id_fk || selectedUni.id

      // 1. Ensure their profile is linked to this university
      const { error: profileError } = await supabase.from('profiles').update({
        university_id_fk: targetUniId
      }).eq('id', user.id)

      if (profileError) throw profileError

      // 2. Create Organization
      const { data: org, error: orgError } = await supabase.from('organizations').insert({
        name: orgForm.name,
        slug,
        department: orgForm.department,
        description: orgForm.description,
        owner_id: user.id,
        university_id: targetUniId
      }).select().single()

      if (orgError) throw orgError

      toast.success('Organization registered successfully!')
      router.push('/org/dashboard')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to create organization')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl relative">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] 
          bg-cyber-green/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="glass-card p-8 md:p-12 relative z-10 overflow-hidden">
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${step === 1 ? 'w-8 bg-cyber-green' : 'w-4 bg-white/20'}`} />
            <div className={`h-1.5 rounded-full transition-all duration-500 ${step === 2 ? 'w-8 bg-cyber-green' : 'w-4 bg-white/20'}`} />
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1: Select University */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.15), rgba(0,255,102,0.05))', border: '1px solid rgba(0,255,102,0.2)' }}>
                    <Building2 className="w-8 h-8 text-cyber-green" />
                  </div>
                  <h1 className="text-3xl font-black mb-2">Join a University</h1>
                  <p className="text-white/50">Select the university or campus your organization belongs to.</p>
                </div>

                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input type="text" placeholder="Search universities..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-cyber-green transition-colors" />
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredUnis.length > 0 ? filteredUnis.map(uni => (
                    <button key={uni.id} onClick={() => setSelectedUni(uni)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                        selectedUni?.id === uni.id 
                        ? 'bg-cyber-green/10 border-cyber-green/40 shadow-[0_0_20px_rgba(0,255,102,0.1)]' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}>
                      <div>
                        <p className={`font-bold text-lg ${selectedUni?.id === uni.id ? 'text-cyber-green' : ''}`}>{uni.name}</p>
                        <p className="text-xs text-white/40 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> Tenant: /u/{uni.slug}
                        </p>
                      </div>
                      {selectedUni?.id === uni.id && <CheckCircle2 className="w-6 h-6 text-cyber-green shrink-0" />}
                    </button>
                  )) : (
                    <div className="text-center py-10 text-white/40 text-sm">
                      No universities found. Please ask your Super Admin to provision one first.
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-3">
                  <Link href="/auth" className="btn-ghost flex-1 justify-center">Cancel</Link>
                  <button onClick={() => setStep(2)} disabled={!selectedUni} 
                    className="btn-cyber flex-1 justify-center disabled:opacity-30">
                    Next Step
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Organization Details */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(0,255,102,0.15), rgba(0,255,102,0.05))', border: '1px solid rgba(0,255,102,0.2)' }}>
                    <Zap className="w-8 h-8 text-cyber-green" />
                  </div>
                  <h1 className="text-3xl font-black mb-2">Create Organization</h1>
                  <p className="text-white/50">You're registering a new organization under <strong className="text-white">{selectedUni?.name}</strong></p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Organization Name *</label>
                    <input required placeholder="e.g. Computer Science Society"
                      value={orgForm.name} onChange={e => setOrgForm(p => ({...p, name: e.target.value}))}
                      className="input-cyber w-full py-3.5" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Department (Optional)</label>
                    <input placeholder="e.g. School of Engineering"
                      value={orgForm.department} onChange={e => setOrgForm(p => ({...p, department: e.target.value}))}
                      className="input-cyber w-full py-3.5" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Description</label>
                    <textarea rows={3} placeholder="What does your organization do?"
                      value={orgForm.description} onChange={e => setOrgForm(p => ({...p, description: e.target.value}))}
                      className="input-cyber w-full resize-none" />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={async () => {
                      const { data: p } = await supabase.from('profiles').select('university_id_fk').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
                      if (!p?.university_id_fk) {
                        setStep(1)
                      } else {
                        toast.error('Your university is permanently assigned by your college admin.')
                      }
                    }} className="btn-ghost flex-1 justify-center">Back</button>
                    <button type="submit" disabled={submitting} className="btn-cyber flex-1 justify-center">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Launch Dashboard</>}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
