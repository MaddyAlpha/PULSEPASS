-- Fix: Allow anonymous (unauthenticated) users to read active universities
-- This is needed so the public signup page can show the university dropdown

-- Drop the existing policy first
DROP POLICY IF EXISTS "universities_select_active" ON public.universities;

-- Create a new policy that works for BOTH anonymous and authenticated users
CREATE POLICY "universities_select_active" ON public.universities
  FOR SELECT USING (
    is_active = TRUE  -- Anonymous users can always see active universities
    OR
    EXISTS (          -- Super admins can also see inactive ones
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );
