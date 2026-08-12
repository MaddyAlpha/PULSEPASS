-- Fix org_members_supervisors RLS policies to allow org admins (invited with admin role) to manage members
-- We use a SECURITY DEFINER function to prevent infinite recursion when querying the same table in its own policy.

CREATE OR REPLACE FUNCTION public.is_org_admin_member(check_org_id UUID, check_user_id UUID)
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
    public.is_org_admin_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members_supervisors;
CREATE POLICY "org_members_insert_owner" ON public.org_members_supervisors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_org_admin_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_update" ON public.org_members_supervisors;
CREATE POLICY "org_members_update" ON public.org_members_supervisors
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_org_admin_member(org_id, auth.uid())
  );

DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members_supervisors;
CREATE POLICY "org_members_delete_owner" ON public.org_members_supervisors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id AND o.owner_id = auth.uid()
    ) OR
    public.is_org_admin_member(org_id, auth.uid())
  );
