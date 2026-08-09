-- ============================================================
-- PulsePass — Admin Profile Updates
-- Migration: 05_admin_profiles.sql
-- ============================================================

-- Allow super_admin to update ANY profile (needed to assign roles)
CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Allow university_admin to update profiles (needed to assign college_admin)
-- Only allowed to assign college_admin, but RLS on columns is tricky.
-- For now, allow them to update profiles if they are a university admin.
CREATE POLICY "profiles_update_university_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'university_admin')
  );
