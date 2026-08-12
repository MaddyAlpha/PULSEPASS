-- Fix colleges and committees RLS policies to use university_id_fk instead of the deprecated university_id text column

-- 1. Colleges
DROP POLICY IF EXISTS "colleges_insert_admin" ON public.colleges;
CREATE POLICY "colleges_insert_admin" ON public.colleges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id)
      )
    )
  );

DROP POLICY IF EXISTS "colleges_update_admin" ON public.colleges;
CREATE POLICY "colleges_update_admin" ON public.colleges
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

-- 2. Committees
DROP POLICY IF EXISTS "committees_insert_admin" ON public.committees;
CREATE POLICY "committees_insert_admin" ON public.committees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id) OR
        (p.role = 'college_admin' AND p.college_id = college_id)
      )
    )
  );

DROP POLICY IF EXISTS "committees_update_admin" ON public.committees;
CREATE POLICY "committees_update_admin" ON public.committees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id) OR
        (p.role = 'college_admin' AND p.college_id = college_id)
      )
    )
  );

DROP POLICY IF EXISTS "committees_delete_admin" ON public.committees;
CREATE POLICY "committees_delete_admin" ON public.committees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id) OR
        (p.role = 'college_admin' AND p.college_id = college_id)
      )
    )
  );
