-- ============================================================
-- PulsePass — College Admin Features
-- Migration: 07_college_admin.sql
-- ============================================================

-- 1. Add college_id to organizations to track college membership
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE;

-- 2. Update Join Requests RLS to allow college admins to view/action requests
DROP POLICY IF EXISTS "join_req_select_admin" ON public.org_join_requests;
DROP POLICY IF EXISTS "join_req_update_admin" ON public.org_join_requests;

CREATE POLICY "join_req_select_admin" ON public.org_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = org_join_requests.university_id) OR
        (p.role = 'college_admin' AND p.college_id = org_join_requests.college_id)
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
        (p.role = 'university_admin' AND p.university_id_fk = org_join_requests.university_id) OR
        (p.role = 'college_admin' AND p.college_id = org_join_requests.college_id)
      )
    )
  );

-- 3. Update Organizations RLS so College Admins can remove organizations from their college
CREATE POLICY "orgs_update_college_admin" ON public.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'college_admin'
      AND p.college_id = organizations.college_id
    )
  );

-- Also add one for University Admins to update orgs (e.g. to kick them out)
CREATE POLICY "orgs_update_university_admin" ON public.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'university_admin'
      AND p.university_id_fk = organizations.university_id
    )
  );
