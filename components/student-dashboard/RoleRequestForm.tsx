'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { KeyRound, Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function RoleRequestForm({ 
  userId, 
  universityId 
}: { 
  userId: string
  universityId: string 
}) {
  const supabase = createClient()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return

    setLoading(true)
    
    // 1. Verify code and fetch college regex
    const { data: inviteCode, error: fetchError } = await supabase
      .from('college_invite_codes')
      .select(`
        code, 
        college_id,
        college:colleges (
          roll_number_regex,
          roll_number_format_hint
        )
      `)
      .eq('code', code.toUpperCase())
      .eq('university_id', universityId)
      .eq('is_active', true)
      .single()

    if (fetchError || !inviteCode) {
      toast.error('Invalid or expired invite code')
      setLoading(false)
      return
    }

    // 2. Fetch user's roll number to validate against college regex
    const { data: profile } = await supabase.from('profiles').select('roll_number').eq('id', userId).single()
    
    // Check college regex if it exists
    const college = inviteCode.college as any
    if (college?.roll_number_regex && profile?.roll_number) {
      const regex = new RegExp(college.roll_number_regex)
      if (!regex.test(profile.roll_number)) {
        toast.error(`Your roll number does not match this college's required format: ${college.roll_number_format_hint || 'Contact College Admin'}`)
        setLoading(false)
        return
      }
    }

    // 2. Submit role request
    const { error: requestError } = await supabase
      .from('role_requests')
      .insert({
        user_id: userId,
        college_id: inviteCode.college_id,
        university_id: universityId,
        invite_code: inviteCode.code,
        status: 'pending'
      })

    if (requestError) {
      if (requestError.code === '23505') {
        toast.error('You already have a pending request for this college.')
      } else {
        toast.error('Failed to submit request')
      }
    } else {
      toast.success('Organiser request submitted successfully!')
      setCode('')
    }
    
    setLoading(false)
  }

  return (
    <div className="p-4 rounded-xl mt-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-xs text-cyber-green uppercase tracking-wider mb-3">Request Organiser Access</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            required
            placeholder="Enter College Invite Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="input-cyber pl-10 w-full"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading || !code}
          className="btn-cyber py-2.5 px-4 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
