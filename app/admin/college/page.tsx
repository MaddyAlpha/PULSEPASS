'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Loader2, Key } from 'lucide-react'

export default function CollegeAdminPage() {
  const supabase = createClient()
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchCodes()
  }, [])

  const fetchCodes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('college_invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error('Failed to load invite codes')
    } else {
      setCodes(data || [])
    }
    setLoading(false)
  }

  const generateCode = async () => {
    setGenerating(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return

    // Create a random 6 character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Get current user's profile to extract college_id and university_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('college_id, university_id_fk')
      .eq('id', user.user.id)
      .single()

    if (!profile || !profile.college_id || !profile.university_id_fk) {
      toast.error('Your profile is missing college or university affiliation')
      setGenerating(false)
      return
    }

    const { error } = await supabase.from('college_invite_codes').insert({
      code,
      college_id: profile.college_id,
      university_id: profile.university_id_fk,
      created_by: user.user.id,
      is_active: true
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Code generated successfully')
      fetchCodes()
    }
    setGenerating(false)
  }

  const deactivateCode = async (id: string) => {
    const { error } = await supabase
      .from('college_invite_codes')
      .update({ is_active: false })
      .eq('id', id)
    
    if (error) {
      toast.error('Failed to deactivate code')
    } else {
      toast.success('Code deactivated')
      fetchCodes()
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Key className="w-8 h-8 text-cyber-green" />
          College Admin Dashboard
        </h1>
        <p className="text-white/60 mt-2">Manage invite codes for your college.</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Active Invite Codes</h2>
          <button
            onClick={generateCode}
            disabled={generating}
            className="btn-cyber py-2 px-4 flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate New Code
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 text-cyber-green animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
            <p className="text-white/40">No invite codes found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-sm">
                  <th className="p-4 font-medium uppercase">Code</th>
                  <th className="p-4 font-medium uppercase">Status</th>
                  <th className="p-4 font-medium uppercase">Created At</th>
                  <th className="p-4 font-medium uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <span className="font-mono text-lg text-cyber-green tracking-widest">{code.code}</span>
                    </td>
                    <td className="p-4">
                      {code.is_active ? (
                        <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-bold">ACTIVE</span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold">INACTIVE</span>
                      )}
                    </td>
                    <td className="p-4 text-white/60">
                      {new Date(code.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      {code.is_active && (
                        <button
                          onClick={() => deactivateCode(code.id)}
                          className="p-2 text-white/40 hover:text-red-400 transition-colors"
                          title="Deactivate Code"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
