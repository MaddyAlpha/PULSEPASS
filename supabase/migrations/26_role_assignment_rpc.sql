-- Create secure RPC functions for assigning and removing roles bypassing RLS restrictions.

CREATE OR REPLACE FUNCTION public.assign_org_role(
  target_user_id UUID,
  new_role user_role,
  new_batch_prefix TEXT,
  target_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_org_member_role org_member_role;
BEGIN
  -- Check if the current user is authorized to assign roles for this org
  -- Must be owner or admin of the org, or super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = target_org_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.org_members_supervisors WHERE org_id = target_org_id AND user_id = auth.uid() AND member_role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to assign roles for this organization';
  END IF;

  -- 1. Update the profiles table
  UPDATE public.profiles
  SET 
    role = new_role,
    cr_batch_prefix = new_batch_prefix
  WHERE id = target_user_id;

  -- 2. Update the org_members_supervisors table
  IF target_org_id IS NOT NULL AND new_role IN ('supervisor', 'committee_admin', 'org_admin') THEN
    IF new_role IN ('committee_admin', 'org_admin') THEN
      v_org_member_role := 'admin';
    ELSE
      v_org_member_role := 'supervisor';
    END IF;

    INSERT INTO public.org_members_supervisors (
      org_id, user_id, member_role, invited_by, accepted
    ) VALUES (
      target_org_id, target_user_id, v_org_member_role, auth.uid(), true
    )
    ON CONFLICT (org_id, user_id) DO UPDATE SET
      member_role = EXCLUDED.member_role,
      invited_by = EXCLUDED.invited_by,
      accepted = true;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.remove_org_role(
  target_user_id UUID,
  target_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN;
BEGIN
  -- Check if the current user is authorized
  SELECT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = target_org_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.org_members_supervisors WHERE org_id = target_org_id AND user_id = auth.uid() AND member_role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to remove roles for this organization';
  END IF;

  -- 1. Reset profile to student
  UPDATE public.profiles
  SET 
    role = 'student',
    cr_batch_prefix = NULL
  WHERE id = target_user_id;

  -- 2. Remove from org_members_supervisors
  IF target_org_id IS NOT NULL THEN
    DELETE FROM public.org_members_supervisors
    WHERE org_id = target_org_id AND user_id = target_user_id;
  END IF;
END;
$$;
