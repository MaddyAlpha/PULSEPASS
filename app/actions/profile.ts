'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestOrganiserAccess(code: string, userId: string, universityId: string) {
  const supabase = await createClient()
  
  if (!code || !userId) {
    return { success: false, error: 'Missing required parameters' }
  }

  // Use a secure RPC to fetch the invite code without needing a Service Role Key locally
  const { data, error: fetchError } = await supabase
    .rpc('validate_admin_invite_code', { p_code: code.toUpperCase() })
    .single()

  const inviteCode = data as any

  if (fetchError || !inviteCode) {
    return { success: false, error: 'Invalid or expired invite code' }
  }

  if (inviteCode.role !== 'organiser') {
    return { success: false, error: 'This code is not meant for an organiser role' }
  }

  // Fetch user's roll number to validate against college regex
  const { data: profile } = await supabase.from('profiles').select('roll_number').eq('id', userId).single()
  
  if (inviteCode.roll_number_regex && profile?.roll_number) {
    const regex = new RegExp(inviteCode.roll_number_regex)
    if (!regex.test(profile.roll_number)) {
      return { 
        success: false, 
        error: `Your roll number does not match this college's required format: ${inviteCode.roll_number_format_hint || 'Contact College Admin'}` 
      }
    }
  }

  // Submit role request
  const { error: requestError } = await supabase
    .from('role_requests')
    .insert({
      user_id: userId,
      college_id: inviteCode.college_id,
      university_id: inviteCode.university_id || universityId,
      invite_code: inviteCode.code,
      status: 'pending'
    })

  if (requestError) {
    if (requestError.code === '23505') {
      return { success: false, error: 'You already have a pending request for this college.' }
    }
    return { success: false, error: 'Failed to submit request' }
  }
  
  // IMMEDIATELY EXPIRE the invite code after it is successfully submitted.
  // We use another secure RPC to consume the code without needing RLS bypass or Service Keys.
  await supabase.rpc('consume_admin_invite_code', { 
    p_code: inviteCode.code, 
    p_user_id: userId 
  })

  revalidatePath('/profile')
  return { success: true }
}

export async function joinCommittee(code: string, userId: string) {
  const supabase = await createClient()
  
  if (!code || !userId) {
    return { success: false, error: 'Missing parameters' }
  }

  const { data: committee, error } = await supabase
    .from('committees')
    .select('id, name')
    .eq('join_code', code.toUpperCase())
    .single()
    
  if (error || !committee) {
    return { success: false, error: 'Invalid committee join code' }
  }

  // Insert into committee_members table
  const { error: joinError } = await supabase
    .from('committee_members')
    .insert({
      user_id: userId,
      committee_id: committee.id
    })

  if (joinError) {
    if (joinError.code === '23505') {
      return { success: false, error: 'You are already a member of this committee' }
    }
    return { success: false, error: 'Failed to join committee' }
  }

  // Also update legacy committee_id for backward compatibility
  await supabase.from('profiles').update({ committee_id: committee.id }).eq('id', userId)

  revalidatePath('/profile')
  return { success: true, message: `Joined committee: ${committee.name}!` }
}
