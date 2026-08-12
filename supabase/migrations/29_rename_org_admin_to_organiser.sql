-- Rename org_admin to organiser everywhere and update RLS policies

DO $$
BEGIN
  -- 1. Profiles & Invite Codes
  UPDATE public.profiles SET role = 'organiser' WHERE role = 'org_admin';
  UPDATE public.admin_invite_codes SET role = 'organiser' WHERE role = 'org_admin';
END $$;

-- 2. Rename review_queue_select_org_admin to review_queue_select_organiser
DROP POLICY IF EXISTS "review_queue_select_org_admin" ON public.manual_review_queue;
DROP POLICY IF EXISTS "review_queue_select_organiser" ON public.manual_review_queue;
CREATE POLICY "review_queue_select_organiser" ON public.manual_review_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.org_id
      WHERE e.id = event_id AND o.owner_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'university_admin'))
  );

-- 3. Update committees RLS policies (replace org_admin with organiser)
DROP POLICY IF EXISTS "committees_insert_admin" ON public.committees;
CREATE POLICY "committees_insert_admin" ON public.committees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin' OR
        (p.role = 'university_admin' AND p.university_id_fk = university_id) OR
        (p.role = 'college_admin' AND p.college_id = college_id) OR
        (p.role = 'organiser' AND (
          EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM public.org_members_supervisors oms WHERE oms.org_id = org_id AND oms.user_id = auth.uid() AND oms.member_role = 'admin')
        ))
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
        (p.role = 'college_admin' AND p.college_id = college_id) OR
        (p.role = 'organiser' AND (
          EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM public.org_members_supervisors oms WHERE oms.org_id = org_id AND oms.user_id = auth.uid() AND oms.member_role = 'admin')
        ))
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
        (p.role = 'college_admin' AND p.college_id = college_id) OR
        (p.role = 'organiser' AND (
          EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM public.org_members_supervisors oms WHERE oms.org_id = org_id AND oms.user_id = auth.uid() AND oms.member_role = 'admin')
        ))
      )
    )
  );

-- 4. Recreate is_org_admin_member as is_organiser_member
CREATE OR REPLACE FUNCTION public.is_organiser_member(check_org_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members_supervisors
    WHERE org_id = check_org_id AND user_id = check_user_id AND member_role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "org_members_select" ON public.org_members_supervisors;
CREATE POLICY "org_members_select" ON public.org_members_supervisors
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND (
        o.owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
      )
    ) OR
    public.is_organiser_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members_supervisors;
CREATE POLICY "org_members_insert_owner" ON public.org_members_supervisors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_organiser_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_update" ON public.org_members_supervisors;
CREATE POLICY "org_members_update" ON public.org_members_supervisors
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_organiser_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members_supervisors;
CREATE POLICY "org_members_delete_owner" ON public.org_members_supervisors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_organiser_member(org_id, auth.uid())
  );

-- Drop the old function
DROP FUNCTION IF EXISTS public.is_org_admin_member(UUID, UUID);

-- 5. Fix 01_schema.sql org_admin checks
-- "orgs_insert_owner" ON public.organizations
DROP POLICY IF EXISTS "orgs_insert_owner" ON public.organizations;
CREATE POLICY "orgs_insert_owner" ON public.organizations
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('organiser', 'super_admin')
    )
  );

-- 6. Update assign_role RPC to check for 'organiser'
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
  IF target_org_id IS NOT NULL AND new_role IN ('supervisor', 'committee_admin', 'organiser') THEN
    IF new_role IN ('committee_admin', 'organiser') THEN
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
