-- Fix committees RLS policies to allow org_admin to manage committees for their organization

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
        (p.role = 'org_admin' AND (
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
        (p.role = 'org_admin' AND (
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
        (p.role = 'org_admin' AND (
          EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()) OR
          EXISTS (SELECT 1 FROM public.org_members_supervisors oms WHERE oms.org_id = org_id AND oms.user_id = auth.uid() AND oms.member_role = 'admin')
        ))
      )
    )
  );
