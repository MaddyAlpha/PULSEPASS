import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event_id, ticket_type = 'general' } = body

    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    if (!['general', 'vip'].includes(ticket_type)) {
      return NextResponse.json({ error: 'Invalid ticket_type' }, { status: 400 })
    }

    // Call the atomic DB function
    const { data, error } = await supabase
      .rpc('claim_ticket', {
        p_event_id: event_id,
        p_user_id: user.id,
        p_type: ticket_type,
      })

    if (error) {
      // Friendly error messages
      const msg = error.message || ''
      if (msg.includes('sold out')) return NextResponse.json({ error: 'Tickets are sold out' }, { status: 409 })
      if (msg.includes('already have')) return NextResponse.json({ error: 'You already have a ticket for this event' }, { status: 409 })
      if (msg.includes('not published')) return NextResponse.json({ error: 'Event is not available' }, { status: 400 })
      if (msg.includes('not found')) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ ticket: data }, { status: 201 })
  } catch (err) {
    console.error('[/api/tickets POST]', err)
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

    let query = supabase
      .from('tickets')
      .select('*, event:events(title, starts_at, venue, organization:organizations(name))')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: false })

    if (event_id) {
      query = query.eq('event_id', event_id)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tickets: data })
  } catch (err) {
    console.error('[/api/tickets GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
