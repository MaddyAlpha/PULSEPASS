export const runtime = 'edge';
/**
 * POST /api/tickets/vip
 *
 * Issues a VIP pass directly for a student, bypassing OCR.
 * Only callable by committee_admin, org_admin, university_admin, or super_admin.
 *
 * Body: { event_id, student_email, roll_number?, notes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { signQRToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller has admin-level role
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    const allowedRoles = ['org_admin', 'committee_admin', 'college_admin', 'university_admin', 'super_admin']
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions. Must be an org admin or higher.' }, { status: 403 })
    }

    const body = await request.json()
    const { event_id, student_email, roll_number, notes } = body

    if (!event_id || !student_email) {
      return NextResponse.json({ error: 'event_id and student_email are required' }, { status: 400 })
    }

    // Find student by email
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('email', student_email.toLowerCase().trim())
      .single()

    if (!studentProfile) {
      return NextResponse.json({ error: `No user found with email: ${student_email}` }, { status: 404 })
    }

    // Fetch event to verify it exists and has VIP capacity
    const { data: event } = await supabase
      .from('events')
      .select('id, title, vip_capacity, vip_tickets_sold, status')
      .eq('id', event_id)
      .single()

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (event.status !== 'published') return NextResponse.json({ error: 'Event is not published' }, { status: 400 })
    if (event.vip_tickets_sold >= event.vip_capacity) {
      return NextResponse.json({ error: 'VIP capacity is full' }, { status: 409 })
    }

    // Check for existing ticket
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id, ticket_type')
      .eq('event_id', event_id)
      .eq('user_id', studentProfile.id)
      .single()

    if (existingTicket) {
      return NextResponse.json({
        error: `User already has a ${existingTicket.ticket_type} ticket for this event`,
      }, { status: 409 })
    }

    // Issue VIP ticket using admin client (bypasses RLS capacity check)
    const { data: ticket, error: insertError } = await adminSupabase
      .from('tickets')
      .insert({
        event_id,
        user_id: studentProfile.id,
        ticket_type: 'vip',
        ticket_status: 'valid',
        ocr_verified: true,
        is_vip_bypass: true,
        roll_number: roll_number || null,
        notes: notes || `VIP pass issued by ${callerProfile.full_name || user.email}`,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[VIP insert error]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Increment vip_tickets_sold
    await adminSupabase
      .from('events')
      .update({ vip_tickets_sold: event.vip_tickets_sold + 1 })
      .eq('id', event_id)

    // Sign JWT QR token
    const jwt_token = await signQRToken({
      ticket_id: ticket.id,
      roll_number: roll_number || '',
      event_id: ticket.event_id,
      ticket_type: 'vip',
    })

    // Log the audit event
    await adminSupabase.rpc('log_audit', {
      p_actor_id: user.id,
      p_actor_role: callerProfile.role,
      p_action: 'ticket.vip_issued',
      p_target_table: 'tickets',
      p_target_id: ticket.id,
      p_payload: { student_email, event_id, roll_number: roll_number || null },
    })

    return NextResponse.json({
      ticket,
      jwt_token,
      student: { email: studentProfile.email, full_name: studentProfile.full_name },
    }, { status: 201 })
  } catch (err) {
    console.error('[/api/tickets/vip POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

