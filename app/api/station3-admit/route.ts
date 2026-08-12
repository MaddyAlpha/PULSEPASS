export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['organiser', 'committee_admin', 'supervisor', 'super_admin', 'university_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { ticket_id, event_id, device_info } = await request.json()
    if (!ticket_id || !event_id) return NextResponse.json({ error: 'ticket_id and event_id are required' }, { status: 400 })

    const { data: result } = await supabase.rpc('process_station3_admit', {
      p_ticket_id: ticket_id,
      p_event_id: event_id,
      p_admitted_by: user.id,
      p_device_info: device_info || null,
    })

    // Note: Broadcast is now handled client-side by the Verifier UI to avoid edge function 500s

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/station3-admit POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

