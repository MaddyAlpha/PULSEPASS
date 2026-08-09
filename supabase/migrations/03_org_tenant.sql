-- Add university_id to organizations so they can belong to a tenant
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE;

-- Ensure RLS allows inserting this column
-- (Existing policies are fine as they just check owner_id)
