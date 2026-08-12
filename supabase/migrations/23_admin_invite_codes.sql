-- ============================================================
-- PulsePass — Admin Invite Codes
-- Migration: 23_admin_invite_codes.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  role user_role NOT NULL,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_invite_codes_select" ON public.admin_invite_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = admin_invite_codes.university_id) OR
      (p.role = 'college_admin' AND p.college_id = admin_invite_codes.college_id)
    ))
  );

CREATE POLICY "admin_invite_codes_insert" ON public.admin_invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = admin_invite_codes.university_id) OR
      (p.role = 'college_admin' AND p.college_id = admin_invite_codes.college_id)
    ))
  );

CREATE POLICY "admin_invite_codes_update" ON public.admin_invite_codes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = admin_invite_codes.university_id) OR
      (p.role = 'college_admin' AND p.college_id = admin_invite_codes.college_id)
    ))
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id UUID;
  v_roll_number TEXT;
  v_college_id UUID;
  v_role user_role;
  v_invite_code TEXT;
  v_invite_record RECORD;
BEGIN
  v_university_id := (NEW.raw_user_meta_data->>'university_id_fk')::UUID;
  v_roll_number := NEW.raw_user_meta_data->>'roll_number';
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student');
  v_invite_code := NEW.raw_user_meta_data->>'invite_code';

  -- If invite code provided, validate and override roles
  IF v_invite_code IS NOT NULL AND v_invite_code != '' THEN
    SELECT * INTO v_invite_record FROM public.admin_invite_codes WHERE code = v_invite_code AND is_used = FALSE;
    
    IF FOUND THEN
      v_role := v_invite_record.role;
      v_university_id := v_invite_record.university_id;
      v_college_id := v_invite_record.college_id;
      
      -- Mark as used
      UPDATE public.admin_invite_codes SET is_used = TRUE, used_by = NEW.id WHERE id = v_invite_record.id;
    END IF;
  ELSE
    -- Attempt to auto-assign a college based on roll number regex
    IF v_university_id IS NOT NULL AND v_roll_number IS NOT NULL THEN
      SELECT id INTO v_college_id
      FROM public.colleges
      WHERE university_id = v_university_id
        AND roll_number_regex IS NOT NULL
        AND v_roll_number ~* roll_number_regex
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    avatar_url, 
    university_id_fk, 
    roll_number,
    college_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    NEW.raw_user_meta_data->>'avatar_url',
    v_university_id,
    v_roll_number,
    v_college_id
  )
  ON CONFLICT (id) DO UPDATE SET
    university_id_fk = EXCLUDED.university_id_fk,
    roll_number = EXCLUDED.roll_number,
    college_id = EXCLUDED.college_id,
    role = EXCLUDED.role;
    
  RETURN NEW;
END;
$$;
