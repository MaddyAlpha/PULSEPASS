'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Plus, ShieldCheck, UserCheck, Key } from 'lucide-react'

export default function CommitteesTab({ org, profile }: { org: any, profile: any }) {
  const supabase = createClient()
  const [committees, setCommittees] = useState<any[]>([])
  const [batchCodes, setBatchCodes] = useState<any[]>([])
  const [crs, setCrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Committee Creation
  const [newCommitteeName, setNewCommitteeName] = useState('')
  const [newCommitteeHeadRoll, setNewCommitteeHeadRoll] = useState('')
  const [creating, setCreating] = useState(false)

  // CR Assignment
  const [crRoll, setCrRoll] = useState('')
  const [crBatchCode, setCrBatchCode] = useState('')
  const [assigningCr, setAssigningCr] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch Committees
    const { data: coms } = await supabase
      .from('committees')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
    
    setCommittees(coms || [])

    // Fetch Batch Codes for University
    if (profile?.university_id_fk) {
      const { data: batches } = await supabase
        .from('university_batch_codes')
        .select('*')
        .eq('university_id', profile.university_id_fk)
      setBatchCodes(batches || [])
    }

    // Fetch Assigned CRs in this college
    if (profile?.college_id) {
      const { data: crData } = await supabase
        .from('profiles')
        .select('id, full_name, roll_number, cr_batch_prefix')
        .eq('college_id', profile.college_id)
        .eq('role', 'supervisor')
      
      setCrs(crData || [])
    }
    
    setLoading(false)
  }

  const handleCreateCommittee = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const joinCode = Math.floor(1000 + Math.random() * 9000).toString() // 4-digit code
      const slug = newCommitteeName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()

      const { error } = await supabase.from('committees').insert({
        name: newCommitteeName,
        slug,
        org_id: org.id,
        college_id: profile.college_id,
        university_id: profile.university_id_fk,
        head_roll_number: newCommitteeHeadRoll.trim(),
        join_code: joinCode
      })

      if (error) throw error

      toast.success('Committee created successfully!')
      setNewCommitteeName('')
      setNewCommitteeHeadRoll('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create committee')
    } finally {
      setCreating(false)
    }
  }

  const handleAssignCr = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssigningCr(true)
    try {
      if (!crRoll || !crBatchCode) throw new Error('Please enter Roll Number and select a Batch')

      // Find the user by roll number
      const { data: userProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('roll_number', crRoll.trim())
        .single()

      if (fetchError || !userProfile) {
        throw new Error('Student not found with this Roll Number')
      }

      // Update their role to CR Verifier (using committee_admin or we can use supervisor. Let's use supervisor for CR but with a specific batch prefix)
      // Since CRs are specific to a batch, we need to save this. 
      // The instructions say: "The Organiser appoints a CR and selects their batch scope... route their pending ID selfie strictly to the dashboard of the CR whose assigned prefix_code matches"
      // We will assign them 'supervisor' role (Station 2/Verifier) and set their `cr_batch_prefix` in profiles.
      
      const { error: updateError } = await supabase.from('profiles').update({
        role: 'supervisor',
        cr_batch_prefix: crBatchCode
      }).eq('id', userProfile.id)

      if (updateError) throw updateError

      toast.success('CR Verifier assigned successfully!')
      setCrRoll('')
      setCrBatchCode('')
      fetchData() // Refresh list
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign CR Verifier')
    } finally {
      setAssigningCr(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Assign CR Verifier Panel */}
      <div className="glass-card p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
          <h2 className="font-bold text-xl">Assign CR Verifier</h2>
        </div>
        <p className="text-sm text-white/40 mb-6">
          Appoint a Class Representative to verify ID selfies for their specific batch.
        </p>

        <form onSubmit={handleAssignCr} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase">CR Roll Number</label>
            <input
              required
              type="text"
              placeholder="e.g. 2026-LS-042"
              value={crRoll}
              onChange={(e) => setCrRoll(e.target.value)}
              className="input-cyber w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase">Batch Scope</label>
            <select
              required
              value={crBatchCode}
              onChange={(e) => setCrBatchCode(e.target.value)}
              className="input-cyber w-full appearance-none bg-obsidian-900"
            >
              <option value="">Select Batch</option>
              {batchCodes.map(bc => (
                <option key={bc.id} value={bc.prefix_code}>
                  {bc.prefix_code} - {bc.description}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={assigningCr} className="btn-cyber w-full justify-center">
              {assigningCr ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign CR'}
            </button>
          </div>
        </form>

        {crs.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Currently Assigned CRs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {crs.map(cr => (
                <div key={cr.id} className="p-3 rounded-lg border border-white/5 bg-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{cr.full_name || 'No Name'}</p>
                    <p className="text-xs text-white/50 font-mono">{cr.roll_number}</p>
                  </div>
                  <div className="px-2 py-1 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {cr.cr_batch_prefix || 'ALL'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Committees Management Panel */}
      <div className="glass-card p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-amber-400" />
            <h2 className="font-bold text-xl">Committees</h2>
          </div>
        </div>
        
        <form onSubmit={handleCreateCommittee} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase">Committee Name</label>
            <input
              required
              type="text"
              placeholder="e.g. Finance Committee"
              value={newCommitteeName}
              onChange={(e) => setNewCommitteeName(e.target.value)}
              className="input-cyber w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase">Head Roll Number</label>
            <input
              required
              type="text"
              placeholder="e.g. 2026-LS-042"
              value={newCommitteeHeadRoll}
              onChange={(e) => setNewCommitteeHeadRoll(e.target.value)}
              className="input-cyber w-full"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={creating} className="w-full btn-ghost border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 justify-center flex items-center gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Committee
            </button>
          </div>
        </form>

        <div className="mb-8">
          <p className="text-xs text-white/40 uppercase mb-2">Quick Presets</p>
          <div className="flex flex-wrap gap-2">
            {['Finance', 'Logistics', 'Marketing', 'Creative & Design', 'Sponsorship', 'Security', 'Technical'].map(preset => (
              <button 
                key={preset}
                type="button"
                onClick={() => setNewCommitteeName(`${preset} Committee`)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 transition-all">
                {preset}
              </button>
            ))}
          </div>
        </div>

        {committees.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
            <p className="text-white/40">No committees created yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {committees.map(com => (
              <div key={com.id} className="p-4 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h3 className="font-bold text-lg mb-2">{com.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/40">Head Roll:</span>
                    <span className="font-mono text-cyber-green">{com.head_roll_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Join Code:</span>
                    <span className="font-mono font-bold tracking-widest bg-white/10 px-2 rounded">{com.join_code}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
