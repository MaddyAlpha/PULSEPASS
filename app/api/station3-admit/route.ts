export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['org_admin', 'committee_admin', 'supervisor', 'super_admin', 'university_admin'].includes(profile.role)) {
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

    // Broadcast final admit to all gate devices
    if (result?.success) {
      await adminSupabase.channel(`gate:${event_id}`).send({
        type: 'broadcast',
        event: 'ticket_admitted',
        payload: { ticket_id, event_id, admitted_by: user.id, admitted_at: new Date().toISOString() },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/station3-admit POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

