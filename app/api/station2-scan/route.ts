export const runtime = 'edge';
/**
 * POST /api/station2-scan
 *
 * Station 2: Verifies a JWT QR token, sets ticket to pending_verification,
 * and broadcasts to Supabase Realtime channel for Station 3.
 *
 * Body: { jwt_token: string, event_id: string, device_info?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyQRToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()

    if (!profile || !['organiser', 'committee_admin', 'supervisor', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Must be a supervisor or org admin' }, { status: 403 })
    }

    const body = await request.json()
    const { jwt_token, event_id, device_info } = body

    if (!jwt_token || !event_id) {
      return NextResponse.json({ error: 'jwt_token and event_id are required' }, { status: 400 })
    }

    // 1. Verify JWT signature and expiry
    let tokenPayload
    try {
      tokenPayload = await verifyQRToken(jwt_token)
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        reason: 'INVALID_QR',
        message: err?.code === 'ERR_JWT_EXPIRED' ? 'QR code expired. Ask attendee to refresh.' : 'Invalid QR token.',
      })
    }

    // 2. Validate token belongs to the correct event
    if (tokenPayload.event_id !== event_id) {
      return NextResponse.json({ success: false, reason: 'INVALID_QR', message: 'QR code is for a different event.' })
    }

    // 3. Call process_station2_scan RPC using ticket_id from JWT
    // First get the ticket's qr_token (static token in DB) via the ticket_id from JWT
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, qr_token, ticket_status, ticket_type, user_id, roll_number, is_vip_bypass')
      .eq('id', tokenPayload.ticket_id)
      .eq('event_id', event_id)
      .single()

    if (!ticket) {
      return NextResponse.json({ success: false, reason: 'INVALID_QR', message: 'Ticket not found.' })
    }

    // 4. Call DB function to set pending_verification atomically
    const { data: scanResult } = await supabase.rpc('process_station2_scan', {
      p_qr_token: ticket.qr_token,
      p_event_id: event_id,
      p_scanned_by: user.id,
      p_device_info: device_info || null,
    })

    if (!scanResult?.success) {
      return NextResponse.json(scanResult)
    }

    // 5. Fetch profile details and return them so the client can broadcast
    const { data: holderProfile } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', ticket.user_id)
      .single()

    return NextResponse.json({
      ...scanResult,
      holderProfile: {
        full_name: holderProfile?.full_name,
        email: holderProfile?.email,
        avatar_url: holderProfile?.avatar_url,
      }
    })
  } catch (err) {
    console.error('[/api/station2-scan POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

