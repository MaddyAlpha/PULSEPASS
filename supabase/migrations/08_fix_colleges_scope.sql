-- ============================================================
-- PulsePass — Fix Colleges RLS (Scope Fix)
-- Migration: 08_fix_colleges_scope.sql
-- ============================================================

DROP POLICY IF EXISTS "colleges_insert_admin" ON public.colleges;
DROP POLICY IF EXISTS "colleges_update_admin" ON public.colleges;

CREATE POLICY "colleges_insert_admin" ON public.colleges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = colleges.university_id)
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
        (p.role = 'university_admin' AND p.university_id_fk = colleges.university_id)
      )
    )
  );

-- Fix committees as well
DROP POLICY IF EXISTS "committees_insert_admin" ON public.committees;

CREATE POLICY "committees_insert_admin" ON public.committees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = committees.university_id) OR
        (p.role = 'college_admin' AND p.college_id = committees.college_id)
      )
    )
  );
