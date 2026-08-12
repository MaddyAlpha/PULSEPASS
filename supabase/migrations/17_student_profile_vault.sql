-- ============================================================
-- PulsePass — Student Profile Vault Migration
-- Migration: 16_student_profile_vault.sql
-- ============================================================

-- 1. Add id_card_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_card_url TEXT;

-- 2. Create committee_members table (many-to-many)
CREATE TABLE IF NOT EXISTS public.committee_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, committee_id)
);

-- Enable RLS on committee_members
ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view committee memberships"
    ON public.committee_members FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('committee_admin', 'organiser', 'college_admin', 'university_admin', 'super_admin')
        )
    );

CREATE POLICY "Users can insert their own memberships"
    ON public.committee_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memberships"
    ON public.committee_members FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Create student-ids storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-ids', 'student-ids', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for student-ids
CREATE POLICY "Users can upload their own ID"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'student-ids' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own ID"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'student-ids' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own ID"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-ids' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Super and University Admins can view all IDs"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'student-ids' AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'university_admin', 'college_admin')
    )
);
