'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Users, Plus, Shield, Link as LinkIcon, RefreshCw } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'

export default function CommitteesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [committees, setCommittees] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  
  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [newComName, setNewComName] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Assign Head
  const [assigningHeadFor, setAssigningHeadFor] = useState<string | null>(null)
  const [headRollNumber, setHeadRollNumber] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    // Fetch committees
    const { data: coms } = await supabase
      .from('committees')
      .select('*')
      .eq('university_id', p.university_id_fk)
      .order('created_at', { ascending: false })
      
    setCommittees(coms || [])
    setLoading(false)
  }

  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComName.trim()) return
    setActionLoading('create')
    try {
      const slug = newComName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { error } = await supabase.from('committees').insert({
        name: newComName.trim(),
        slug,
        university_id: profile.university_id_fk,
        college_id: profile.college_id
      })
      if (error) throw error
      toast.success('Committee created!')
      setNewComName('')
      setShowCreate(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create committee')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateJoinCode = async (id: string) => {
    setActionLoading(`code_${id}`)
    try {
      // Generate 4-digit code
      const join_code = Math.floor(1000 + Math.random() * 9000).toString()
      const { error } = await supabase.from('committees').update({ join_code }).eq('id', id)
      if (error) throw error
      toast.success('Generated new join code!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate code')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignHead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningHeadFor || !headRollNumber.trim()) return
    setActionLoading(`head_${assigningHeadFor}`)
    try {
      const { error } = await supabase
        .from('committees')
        .update({ head_roll_number: headRollNumber.trim().toUpperCase() })
        .eq('id', assigningHeadFor)
      if (error) throw error
      toast.success('Committee Head assigned!')
      setAssigningHeadFor(null)
      setHeadRollNumber('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign head')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian-900">
      <Navbar />
      <div className="pt-24 pb-16 max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-cyber-green" />
              Committee Management
            </h1>
            <p className="text-white/60 mt-2">Create teams and delegate operations to Committee Heads.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-cyber flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Committee
          </button>
        </div>

        {showCreate && (
          <div className="glass-card p-6 mb-8 border border-cyber-green/30">
            <h2 className="text-lg font-bold mb-4">Create New Committee</h2>
            <form onSubmit={handleCreateCommittee} className="flex gap-3">
              <input
                autoFocus
                required
                type="text"
                value={newComName}
                onChange={e => setNewComName(e.target.value)}
                placeholder="e.g. Finance, Cultural, Logistics..."
                className="input-cyber flex-1"
              />
              <button disabled={actionLoading === 'create'} type="submit" className="btn-cyber whitespace-nowrap">
                {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 text-white/50 hover:text-white">
                Cancel
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {committees.map(com => (
            <div key={com.id} className="glass-card p-6 flex flex-col justify-between" style={{ minHeight: '220px' }}>
              <div>
                <h3 className="text-xl font-bold mb-1">{com.name}</h3>
                <p className="text-sm text-white/40 font-mono mb-4">/c/{com.slug}</p>
                
                {/* Head Info */}
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <Shield className={`w-4 h-4 ${com.head_roll_number ? 'text-amber-400' : 'text-white/20'}`} />
                  {com.head_roll_number ? (
                    <div>
                      <p className="text-xs text-white/50 uppercase">Committee Head</p>
                      <p className="font-mono text-amber-400 font-bold">{com.head_roll_number}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningHeadFor(com.id)}
                      className="text-sm text-amber-400/70 hover:text-amber-400 font-semibold flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Assign Head Roll Number
                    </button>
                  )}
                </div>

                {assigningHeadFor === com.id && (
                  <form onSubmit={handleAssignHead} className="flex gap-2 mb-4">
                    <input
                      autoFocus
                      required
                      type="text"
                      value={headRollNumber}
                      onChange={e => setHeadRollNumber(e.target.value)}
                      placeholder="Roll Number (e.g. 2026-CS-01)"
                      className="input-cyber w-full text-sm py-1.5"
                    />
                    <button disabled={actionLoading === `head_${com.id}`} type="submit" className="px-3 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold text-sm">
                      {actionLoading === `head_${com.id}` ? '...' : 'Set'}
                    </button>
                    <button type="button" onClick={() => setAssigningHeadFor(null)} className="px-2 text-white/40 hover:text-white">x</button>
                  </form>
                )}
              </div>

              {/* Join Code */}
              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Member Join Code</p>
                  {com.join_code ? (
                    <p className="text-2xl font-black font-mono tracking-widest text-cyber-green mt-1">{com.join_code}</p>
                  ) : (
                    <p className="text-sm text-white/30 italic mt-1">No code generated</p>
                  )}
                </div>
                <button
                  onClick={() => handleGenerateJoinCode(com.id)}
                  disabled={actionLoading === `code_${com.id}`}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  {actionLoading === `code_${com.id}` ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 text-white/70" />}
                </button>
              </div>
            </div>
          ))}
          {committees.length === 0 && !showCreate && (
            <div className="col-span-full py-16 text-center border border-white/[0.06] rounded-3xl border-dashed">
              <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No committees created yet. Create one to start delegating.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
