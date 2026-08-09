-- ============================================================
-- PulsePass — Add college_id to profiles
-- Migration: 10_add_college_id_to_profiles.sql
-- ============================================================

-- Add college_id to profiles so users can be assigned as college_admin
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL;

-- Update the user_role ENUM to include college_admin if not already present
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'college_admin';

-- Force Supabase API to reload schema cache so it recognizes the new column
NOTIFY pgrst, 'reload schema';
