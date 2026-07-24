-- ============================================================
-- PulsePass — Full Database Schema + RLS Policies
-- Migration: 01_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('student', 'org_admin', 'supervisor', 'super_admin');
CREATE TYPE ticket_type AS ENUM ('general', 'vip');
CREATE TYPE ticket_status AS ENUM ('valid', 'checked_in', 'expired', 'cancelled');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE org_member_role AS ENUM ('admin', 'supervisor', 'viewer');

-- ============================================================
-- PROFILES TABLE
-- ============================================================

CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'student',
  university_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: authenticated users can read profiles (prevents infinite recursion)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- ORGANIZATIONS TABLE
-- ============================================================

CREATE TABLE public.organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  department      TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  verification_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Everyone can read published org info
CREATE POLICY "orgs_select_public" ON public.organizations
  FOR SELECT USING (TRUE);

-- Only owner or super_admin can insert
CREATE POLICY "orgs_insert_owner" ON public.organizations
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('org_admin', 'super_admin')
    )
  );

CREATE POLICY "orgs_update_owner" ON public.organizations
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "orgs_delete_owner" ON public.organizations
  FOR DELETE USING (
    auth.uid() = owner_id OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ============================================================
-- ORG MEMBERS / SUPERVISORS TABLE
-- ============================================================

CREATE TABLE public.org_members_supervisors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role     org_member_role NOT NULL DEFAULT 'supervisor',
  invited_by      UUID REFERENCES public.profiles(id),
  invite_email    TEXT,
  event_scopes    UUID[] DEFAULT '{}',        -- specific event IDs this supervisor can access
  accepted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.org_members_supervisors ENABLE ROW LEVEL SECURITY;

-- Org admins/owners can manage members
CREATE POLICY "org_members_select" ON public.org_members_supervisors
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
      )
    )
  );

CREATE POLICY "org_members_insert_owner" ON public.org_members_supervisors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "org_members_update" ON public.org_members_supervisors
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "org_members_delete_owner" ON public.org_members_supervisors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    )
  );

-- ============================================================
-- EVENTS TABLE
-- ============================================================

CREATE TABLE public.events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT,
  banner_url          TEXT,
  venue               TEXT NOT NULL,
  venue_map_url       TEXT,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  status              event_status NOT NULL DEFAULT 'draft',
  general_capacity    INTEGER NOT NULL DEFAULT 100,
  vip_capacity        INTEGER NOT NULL DEFAULT 20,
  general_tickets_sold INTEGER NOT NULL DEFAULT 0,
  vip_tickets_sold    INTEGER NOT NULL DEFAULT 0,
  requires_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  roll_number_pattern TEXT,
  tags                TEXT[] DEFAULT '{}',
  created_by          UUID NOT NULL REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT events_capacity_positive CHECK (general_capacity >= 0 AND vip_capacity >= 0)
);

CREATE INDEX idx_events_org_id ON public.events(org_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_starts_at ON public.events(starts_at);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Published events visible to all authenticated users
CREATE POLICY "events_select_published" ON public.events
  FOR SELECT USING (
    status = 'published' OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.org_members_supervisors oms
      WHERE oms.org_id = org_id AND oms.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Org owner/admins can insert events
CREATE POLICY "events_insert_org_owner" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "events_update_org_owner" ON public.events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "events_delete_org_owner" ON public.events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TICKETS TABLE
-- ============================================================

CREATE TABLE public.tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_type     ticket_type NOT NULL DEFAULT 'general',
  ticket_status   ticket_status NOT NULL DEFAULT 'valid',
  qr_token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  seat_number     TEXT,
  notes           TEXT,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_tickets_event_id ON public.tickets(event_id);
CREATE INDEX idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX idx_tickets_qr_token ON public.tickets(qr_token);
CREATE INDEX idx_tickets_status ON public.tickets(ticket_status);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Students can read their own tickets
CREATE POLICY "tickets_select_own" ON public.tickets
  FOR SELECT USING (user_id = auth.uid());

-- Org owners/supervisors can read tickets for their events
CREATE POLICY "tickets_select_org" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.org_members_supervisors oms
          WHERE oms.org_id = o.id AND oms.user_id = auth.uid() AND
          (oms.event_scopes = '{}' OR event_id = ANY(oms.event_scopes))
        )
      )
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Students can claim tickets (insert) when capacity is available
CREATE POLICY "tickets_insert_student" ON public.tickets
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.status = 'published' AND (
        (ticket_type = 'general' AND e.general_tickets_sold < e.general_capacity) OR
        (ticket_type = 'vip' AND e.vip_tickets_sold < e.vip_capacity)
      )
    )
  );

-- Only system/org can update ticket status
CREATE POLICY "tickets_update_org_supervisor" ON public.tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.org_members_supervisors oms
          WHERE oms.org_id = o.id AND oms.user_id = auth.uid()
        )
      )
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ============================================================
-- CHECKINS TABLE
-- ============================================================

CREATE TABLE public.checkins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanned_by      UUID NOT NULL REFERENCES public.profiles(id),
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_info     TEXT,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  failure_reason  TEXT
);

CREATE INDEX idx_checkins_ticket_id ON public.checkins(ticket_id);
CREATE INDEX idx_checkins_event_id ON public.checkins(event_id);
CREATE INDEX idx_checkins_scanned_at ON public.checkins(scanned_at);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Supervisors and org owners can insert check-ins
CREATE POLICY "checkins_insert_supervisor" ON public.checkins
  FOR INSERT WITH CHECK (
    scanned_by = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.organizations o ON o.id = e.org_id
        WHERE e.id = event_id AND (
          o.owner_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.org_members_supervisors oms
            WHERE oms.org_id = o.id AND oms.user_id = auth.uid() AND
            (oms.event_scopes = '{}' OR event_id = ANY(oms.event_scopes))
          )
        )
      ) OR
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    )
  );

CREATE POLICY "checkins_select_org" ON public.checkins
  FOR SELECT USING (
    scanned_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.org_members_supervisors oms
          WHERE oms.org_id = o.id AND oms.user_id = auth.uid()
        )
      )
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function: claim ticket atomically (prevents race conditions on capacity)
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

-- Function: process QR scan check-in atomically
CREATE OR REPLACE FUNCTION public.process_checkin(
  p_qr_token    TEXT,
  p_event_id    UUID,
  p_scanned_by  UUID,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket    public.tickets;
  v_checkin   public.checkins;
  v_result    JSONB;
BEGIN
  -- Lock and fetch ticket
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE qr_token = p_qr_token AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.checkins (ticket_id, event_id, scanned_by, success, failure_reason, device_info)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      p_event_id,
      p_scanned_by,
      FALSE,
      'Invalid QR code',
      p_device_info
    );
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_QR', 'message', 'Invalid or unrecognized QR code');
  END IF;

  IF v_ticket.ticket_status = 'checked_in' THEN
    INSERT INTO public.checkins (ticket_id, event_id, scanned_by, success, failure_reason, device_info)
    VALUES (v_ticket.id, p_event_id, p_scanned_by, FALSE, 'Already checked in', p_device_info);
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_USED', 'message', 'Ticket already used', 'ticket_id', v_ticket.id);
  END IF;

  IF v_ticket.ticket_status = 'expired' OR v_ticket.ticket_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_STATUS', 'message', 'Ticket is ' || v_ticket.ticket_status);
  END IF;

  -- Mark as checked in
  UPDATE public.tickets SET ticket_status = 'checked_in', updated_at = NOW() WHERE id = v_ticket.id;

  -- Record check-in
  INSERT INTO public.checkins (ticket_id, event_id, scanned_by, success, device_info)
  VALUES (v_ticket.id, p_event_id, p_scanned_by, TRUE, p_device_info)
  RETURNING * INTO v_checkin;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'VALID',
    'message', 'Check-in successful',
    'ticket_id', v_ticket.id,
    'ticket_type', v_ticket.ticket_type,
    'user_id', v_ticket.user_id,
    'checkin_id', v_checkin.id,
    'checkin_at', v_checkin.scanned_at
  );
END;
$$;

-- ============================================================
-- SEED: Super Admin Role (update after first user signs up)
-- UPDATE public.profiles SET role = 'super_admin' WHERE email = 'admin@yourdomain.com';
-- ============================================================
