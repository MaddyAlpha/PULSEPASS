export const runtime = 'edge';
/**
 * POST /api/tickets/refresh-qr
 *
 * Issues a fresh 30-second JWT QR token for an existing, valid ticket.
 * Called by the client every 25s to keep the QR code live.
 *
 * Body: { ticket_id: string }
 * Response: { jwt_token: string, expires_at: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signQRToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ticket_id } = body

    if (!ticket_id || typeof ticket_id !== 'string') {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 })
    }

    // Fetch the ticket — user can only refresh their own tickets
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, event_id, user_id, ticket_type, ticket_status, roll_number')
      .eq('id', ticket_id)
      .eq('user_id', user.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!['valid', 'pending_verification'].includes(ticket.ticket_status)) {
      return NextResponse.json(
        { error: `Cannot refresh QR for ticket with status: ${ticket.ticket_status}` },
        { status: 409 }
      )
    }

    // Sign a new 30-second JWT
    const jwt_token = await signQRToken({
      ticket_id: ticket.id,
      roll_number: ticket.roll_number || '',
      event_id: ticket.event_id,
      ticket_type: ticket.ticket_type,
    })

    const expires_at = Math.floor(Date.now() / 1000) + 30

    return NextResponse.json({ jwt_token, expires_at })
  } catch (err) {
    console.error('[/api/tickets/refresh-qr POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

