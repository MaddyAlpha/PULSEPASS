-- ============================================================
-- PulsePass — Multi-Tenant Architecture Migration
-- Migration: 02_multi_tenant.sql
-- FRESH INSTALL: Run AFTER 01_schema.sql
-- ============================================================

-- ============================================================
-- STEP 1: EXPAND ENUMS (PostgreSQL requires ALTER TYPE)
-- ============================================================

-- Expand user_role enum with new admin tiers
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'university_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'college_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'committee_admin';

-- Add pending_verification to ticket_status for Phase 2 gate pipeline
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'pending_verification';

-- ============================================================
-- STEP 2: UNIVERSITIES TABLE (Top-Level Tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.universities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,                        -- used in /u/[slug] path
  domain_alias    TEXT UNIQUE,                                 -- optional: future subdomain support
  logo_url        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,               -- kill-switch
  feature_flags   JSONB NOT NULL DEFAULT '{
    "ocr_required": true,
    "vip_enabled": true,
    "manual_review_enabled": true,
    "ocr_keywords": []
  }'::JSONB,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Everyone can read active university info (for tenant routing)
CREATE POLICY "universities_select_active" ON public.universities
  FOR SELECT USING (is_active = TRUE OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Only super_admin can create/update/delete universities
CREATE POLICY "universities_insert_super_admin" ON public.universities
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "universities_update_super_admin" ON public.universities
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "universities_delete_super_admin" ON public.universities
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE TRIGGER universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- STEP 3: COLLEGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.colleges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(university_id, slug)
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colleges_select" ON public.colleges
  FOR SELECT USING (TRUE);

CREATE POLICY "colleges_insert_admin" ON public.colleges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id = university_id)
      )
    )
  );

CREATE POLICY "colleges_update_admin" ON public.colleges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id = university_id)
      )
    )
  );

-- ============================================================
-- STEP 4: COMMITTEES TABLE (maps to current orgs concept)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.committees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id      UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id   UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  org_id          UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- links to existing org
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(college_id, slug)
);

ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committees_select" ON public.committees
  FOR SELECT USING (TRUE);

CREATE POLICY "committees_insert_admin" ON public.committees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id = university_id) OR
        (p.role = 'college_admin' AND p.college_id = college_id)
      )
    )
  );

-- ============================================================
-- STEP 5: AUDIT LOGS TABLE (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role      user_role,
  university_id   UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,                              -- e.g. 'university.create', 'ticket.vip_issue'
  target_table    TEXT,
  target_id       TEXT,
  payload         JSONB DEFAULT '{}'::JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are INSERT only (no update/delete) — super_admin can read all
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "audit_logs_select_university_admin" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'university_admin'
      AND p.university_id = university_id
    )
  );

-- Index for fast log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_university ON public.audit_logs(university_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ============================================================
-- STEP 6: MANUAL REVIEW QUEUE TABLE (Phase 1 OCR fallback)
-- ============================================================

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.manual_review_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  roll_number         TEXT NOT NULL,
  id_card_image_url   TEXT NOT NULL,                          -- Supabase Storage path
  status              review_status NOT NULL DEFAULT 'pending',
  reviewed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_notes        TEXT,
  ticket_id           UUID REFERENCES public.tickets(id) ON DELETE SET NULL, -- set when approved
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_id)                                   -- one pending review per user per event
);

CREATE INDEX IF NOT EXISTS idx_review_queue_event ON public.manual_review_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON public.manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_user ON public.manual_review_queue(user_id);

ALTER TABLE public.manual_review_queue ENABLE ROW LEVEL SECURITY;

-- Students can insert and view their own submissions
CREATE POLICY "review_queue_insert_student" ON public.manual_review_queue
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "review_queue_select_own" ON public.manual_review_queue
  FOR SELECT USING (user_id = auth.uid());

-- Org admins/committee admins can see queue for their events
CREATE POLICY "review_queue_select_org_admin" ON public.manual_review_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND o.owner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'university_admin'))
  );

-- Admins can update (approve/reject)
CREATE POLICY "review_queue_update_admin" ON public.manual_review_queue
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND o.owner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'university_admin', 'committee_admin'))
  );

-- ============================================================
-- STEP 7: ALTER EXISTING TABLES — ADD TENANT COLUMNS
-- ============================================================

-- Profiles: add tenant scope columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id_fk UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS college_id       UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_id     UUID REFERENCES public.committees(id) ON DELETE SET NULL;

-- Events: add tenant scoping + OCR keywords per event
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS university_id    UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ocr_keywords     TEXT[] DEFAULT '{}',     -- case-insensitive keywords set by event creator
  ADD COLUMN IF NOT EXISTS tenant_slug      TEXT;                    -- denormalized for fast URL routing

-- Tickets: add verification pipeline columns
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ocr_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_vip_bypass        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_station TEXT,               -- 'station_2' | 'station_3'
  ADD COLUMN IF NOT EXISTS roll_number          TEXT;               -- captured during OCR claim

-- ============================================================
-- STEP 8: UPDATED RLS POLICIES FOR SCOPED ADMIN ROLES
-- ============================================================

-- University Admin: can read all events within their university
CREATE POLICY "events_select_university_admin" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'university_admin'
      AND p.university_id_fk = events.university_id
    )
  );

-- University Admin: can read all tickets within their university events
CREATE POLICY "tickets_select_university_admin" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE e.id = tickets.event_id
      AND p.role = 'university_admin'
      AND p.university_id_fk = e.university_id
    )
  );

-- ============================================================
-- STEP 9: DB FUNCTIONS — TENANT UTILITIES
-- ============================================================

-- Function: get university by slug (used in middleware/server)
CREATE OR REPLACE FUNCTION public.get_university_by_slug(p_slug TEXT)
RETURNS public.universities
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.universities WHERE slug = p_slug AND is_active = TRUE LIMIT 1;
$$;

-- Function: log an audit event
CREATE OR REPLACE FUNCTION public.log_audit(
  p_actor_id    UUID,
  p_actor_role  user_role,
  p_university_id UUID DEFAULT NULL,
  p_action      TEXT DEFAULT '',
  p_target_table TEXT DEFAULT NULL,
  p_target_id   TEXT DEFAULT NULL,
  p_payload     JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_role, university_id, action, target_table, target_id, payload)
  VALUES (p_actor_id, p_actor_role, p_university_id, p_action, p_target_table, p_target_id, p_payload);
END;
$$;

-- Function: process Phase 2 scanner scan (sets pending_verification, not yet checked_in)
CREATE OR REPLACE FUNCTION public.process_station2_scan(
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
  v_result    JSONB;
BEGIN
  -- Lock and fetch ticket by JWT sub (ticket_id stored in QR)
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE qr_token = p_qr_token AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_QR', 'message', 'Invalid or unrecognized QR token');
  END IF;

  IF v_ticket.ticket_status = 'checked_in' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_USED', 'message', 'Ticket already admitted', 'ticket_id', v_ticket.id);
  END IF;

  IF v_ticket.ticket_status = 'cancelled' OR v_ticket.ticket_status = 'expired' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_STATUS', 'message', 'Ticket is ' || v_ticket.ticket_status);
  END IF;

  IF v_ticket.ticket_status = 'pending_verification' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_PENDING', 'message', 'Ticket is already pending verification at Station 3', 'ticket_id', v_ticket.id);
  END IF;

  -- Set to pending_verification — Station 3 will finalize
  UPDATE public.tickets
  SET ticket_status = 'pending_verification',
      verification_station = 'station_2',
      updated_at = NOW()
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'PENDING',
    'message', 'Ticket queued for Station 3 verification',
    'ticket_id', v_ticket.id,
    'ticket_type', v_ticket.ticket_type,
    'user_id', v_ticket.user_id,
    'is_vip', v_ticket.is_vip_bypass,
    'roll_number', v_ticket.roll_number
  );
END;
$$;

-- Function: Station 3 — final admit (burns the ticket)
CREATE OR REPLACE FUNCTION public.process_station3_admit(
  p_ticket_id   UUID,
  p_event_id    UUID,
  p_admitted_by UUID,
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
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'NOT_FOUND', 'message', 'Ticket not found');
  END IF;

  IF v_ticket.ticket_status != 'pending_verification' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'WRONG_STATE',
      'message', 'Ticket is not pending verification. Current status: ' || v_ticket.ticket_status);
  END IF;

  -- Burn the ticket
  UPDATE public.tickets
  SET ticket_status = 'checked_in',
      verification_station = 'station_3',
      updated_at = NOW()
  WHERE id = v_ticket.id;

  -- Record checkin
  INSERT INTO public.checkins (ticket_id, event_id, scanned_by, success, device_info)
  VALUES (v_ticket.id, p_event_id, p_admitted_by, TRUE, p_device_info)
  RETURNING * INTO v_checkin;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'ADMITTED',
    'message', 'Attendee admitted successfully',
    'ticket_id', v_ticket.id,
    'ticket_type', v_ticket.ticket_type,
    'user_id', v_ticket.user_id,
    'checkin_id', v_checkin.id,
    'checkin_at', v_checkin.scanned_at
  );
END;
$$;

-- ============================================================
-- STEP 10: INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_university_id ON public.events(university_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_slug ON public.events(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_university_fk ON public.profiles(university_id_fk);
CREATE INDEX IF NOT EXISTS idx_tickets_pending ON public.tickets(ticket_status) WHERE ticket_status = 'pending_verification';
CREATE INDEX IF NOT EXISTS idx_universities_slug ON public.universities(slug);

-- ============================================================
-- NOTE: After running this migration:
-- 1. Create a Storage bucket called 'id-review' (set to private)
-- 2. Run: UPDATE public.profiles SET role = 'super_admin' WHERE email = 'your@email.com';
-- 3. Set environment variable: QR_JWT_SECRET=<your-strong-random-secret>
-- ============================================================
