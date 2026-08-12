-- Fix universities update RLS policy to allow university_admin to update their own university

DROP POLICY IF EXISTS "universities_update_super_admin" ON public.universities;
DROP POLICY IF EXISTS "universities_update_admin" ON public.universities;

CREATE POLICY "universities_update_admin" ON public.universities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND (
        p.role = 'super_admin' OR 
        (p.role = 'university_admin' AND p.university_id_fk = universities.id)
      )
    )
  );
