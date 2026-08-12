export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is authorized as supervisor or org_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['supervisor', 'organiser', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions. Must be a supervisor.' }, { status: 403 })
    }

    const body = await request.json()
    const { qr_token, event_id, device_info } = body

    if (!qr_token || !event_id) {
      return NextResponse.json({ error: 'qr_token and event_id are required' }, { status: 400 })
    }

    // Call the atomic check-in DB function
    const { data, error } = await supabase
      .rpc('process_checkin', {
        p_qr_token: qr_token,
        p_event_id: event_id,
        p_scanned_by: user.id,
        p_device_info: device_info || null,
      })

    if (error) {
      console.error('[checkin rpc error]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // data is the JSONB result from the function
    const result = data as {
      success: boolean
      reason: string
      message: string
      ticket_id?: string
      ticket_type?: string
      user_id?: string
      checkin_id?: string
      checkin_at?: string
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    })
  } catch (err) {
    console.error('[/api/checkin POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const event_id = url.searchParams.get('event_id')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('checkins')
      .select(`
        *,
        ticket:tickets(ticket_type, ticket_status),
        scanner:profiles!scanned_by(full_name, email)
      `)
      .eq('event_id', event_id)
      .order('scanned_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute summary stats
    const successful = data?.filter(c => c.success) || []
    const stats = {
      total_scans: data?.length || 0,
      successful_checkins: successful.length,
      failed_attempts: (data?.length || 0) - successful.length,
    }

    return NextResponse.json({ checkins: data, stats })
  } catch (err) {
    console.error('[/api/checkin GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

