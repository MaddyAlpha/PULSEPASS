'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function requestOrganiserAccess(code: string, userId: string, universityId: string) {
  const supabase = await createClient()
  
  if (!code || !userId) {
    return { success: false, error: 'Missing required parameters' }
  }

  const { data: inviteCode, error: fetchError } = await supabase
    .from('college_invite_codes')
    .select(`
      code, 
      college_id,
      college:colleges (
        university_id,
        roll_number_regex,
        roll_number_format_hint
      )
    `)
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (fetchError || !inviteCode) {
    return { success: false, error: 'Invalid or expired invite code' }
  }

  // Fetch user's roll number to validate against college regex
  const { data: profile } = await supabase.from('profiles').select('roll_number').eq('id', userId).single()
  
  // Check college regex if it exists
  const college = (Array.isArray(inviteCode.college) ? inviteCode.college[0] : inviteCode.college) as any
  if (college?.roll_number_regex && profile?.roll_number) {
    const regex = new RegExp(college.roll_number_regex)
    if (!regex.test(profile.roll_number)) {
      return { 
        success: false, 
        error: `Your roll number does not match this college's required format: ${college.roll_number_format_hint || 'Contact College Admin'}` 
      }
    }
  }

  // Submit role request
  const collegeInfo = (Array.isArray(inviteCode.college) ? inviteCode.college[0] : inviteCode.college) as any
  const { error: requestError } = await supabase
    .from('role_requests')
    .insert({
      user_id: userId,
      college_id: inviteCode.college_id,
      university_id: collegeInfo?.university_id || universityId,
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
  // We use the admin client because students don't have RLS permission to update the invite codes table.
  const adminSupabase = await createAdminClient()
  await adminSupabase
    .from('college_invite_codes')
    .update({ is_active: false })
    .eq('code', inviteCode.code)

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
