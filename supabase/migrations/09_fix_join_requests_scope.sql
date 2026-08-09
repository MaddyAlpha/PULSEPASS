-- ============================================================
-- PulsePass — Fix Join Requests RLS (Scope Fix)
-- Migration: 09_fix_join_requests_scope.sql
-- ============================================================

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
