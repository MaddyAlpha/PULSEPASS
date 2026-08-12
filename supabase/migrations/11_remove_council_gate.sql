-- Migration: Remove Student Council verification gate from claim_ticket
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE OR REPLACE FUNCTION public.claim_ticket(
  p_event_id UUID,
  p_user_id  UUID,
  p_type     ticket_type DEFAULT 'general'
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event   public.events;
  v_ticket  public.tickets;
BEGIN
  -- Lock the event row
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.status != 'published' THEN
    RAISE EXCEPTION 'Event is not published';
  END IF;

  -- Check capacity
  IF p_type = 'general' AND v_event.general_tickets_sold >= v_event.general_capacity THEN
    RAISE EXCEPTION 'General tickets are sold out';
  END IF;

  IF p_type = 'vip' AND v_event.vip_tickets_sold >= v_event.vip_capacity THEN
    RAISE EXCEPTION 'VIP tickets are sold out';
  END IF;

  -- Check if already claimed
  IF EXISTS (SELECT 1 FROM public.tickets WHERE event_id = p_event_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'You already have a ticket for this event';
  END IF;

  -- Insert ticket
  INSERT INTO public.tickets (event_id, user_id, ticket_type, expires_at)
  VALUES (
    p_event_id,
    p_user_id,
    p_type,
    v_event.ends_at + INTERVAL '2 hours'
  )
  RETURNING * INTO v_ticket;

  -- Increment sold counter
  IF p_type = 'general' THEN
    UPDATE public.events SET general_tickets_sold = general_tickets_sold + 1 WHERE id = p_event_id;
  ELSE
    UPDATE public.events SET vip_tickets_sold = vip_tickets_sold + 1 WHERE id = p_event_id;
  END IF;

  RETURN v_ticket;
END;
$$;
