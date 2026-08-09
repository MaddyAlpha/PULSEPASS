-- ============================================================
-- PulsePass — Org Join Request System
-- Migration: 04_join_requests.sql
-- Run AFTER 01, 02, 03 migrations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_join_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  university_id   UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  college_id      UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  requested_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewer_note   TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, university_id)
);

ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;

-- Org owner can submit and view their own requests
CREATE POLICY "join_req_insert" ON public.org_join_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

CREATE POLICY "join_req_select_own" ON public.org_join_requests
  FOR SELECT USING (requested_by = auth.uid());

-- University admin can view and action requests for their university
CREATE POLICY "join_req_select_admin" ON public.org_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id)
      )
    )
  );

CREATE POLICY "join_req_update_admin" ON public.org_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id)
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_join_req_university ON public.org_join_requests(university_id);
CREATE INDEX IF NOT EXISTS idx_join_req_status ON public.org_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_req_org ON public.org_join_requests(org_id);
