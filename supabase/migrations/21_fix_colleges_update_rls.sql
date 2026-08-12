-- Fix colleges RLS policy to allow college admins to update their own college

DROP POLICY IF EXISTS "colleges_update_admin" ON public.colleges;
CREATE POLICY "colleges_update_admin" ON public.colleges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = colleges.university_id) OR
        (p.role = 'college_admin' AND p.college_id = colleges.id)
      )
    )
  );
