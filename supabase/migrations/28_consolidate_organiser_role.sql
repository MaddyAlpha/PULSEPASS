-- Migrate existing 'organiser' roles to 'org_admin' and remove the 'organiser' role

DO $$ 
BEGIN
  -- Update all profiles with role 'organiser' to 'org_admin'
  UPDATE public.profiles
  SET role = 'org_admin'
  WHERE role = 'organiser';
  
  -- Update all admin_invite_codes with role 'organiser' to 'org_admin'
  UPDATE public.admin_invite_codes
  SET role = 'org_admin'
  WHERE role = 'organiser';
END $$;
