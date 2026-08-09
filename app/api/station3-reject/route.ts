export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['org_admin', 'committee_admin', 'supervisor', 'super_admin', 'university_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { ticket_id, event_id } = await request.json()
    if (!ticket_id || !event_id) return NextResponse.json({ error: 'ticket_id and event_id are required' }, { status: 400 })

    // Set ticket back to cancelled
    const { error } = await supabase
      .from('tickets')
      .update({ ticket_status: 'cancelled', verification_station: null, updated_at: new Date().toISOString() })
      .eq('id', ticket_id)
      .eq('event_id', event_id)
      .eq('ticket_status', 'pending_verification')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Ticket rejected and cancelled.' })
  } catch (err) {
    console.error('[/api/station3-reject POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

