-- ============================================================
-- PulsePass — Auto-assign college on signup using Regex
-- Migration: 20_auto_assign_college_on_signup.sql
-- ============================================================

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
BEGIN
  v_university_id := (NEW.raw_user_meta_data->>'university_id_fk')::UUID;
  v_roll_number := NEW.raw_user_meta_data->>'roll_number';

  -- Attempt to auto-assign a college based on roll number regex
  IF v_university_id IS NOT NULL AND v_roll_number IS NOT NULL THEN
    SELECT id INTO v_college_id
    FROM public.colleges
    WHERE university_id = v_university_id
      AND roll_number_regex IS NOT NULL
      AND v_roll_number ~* roll_number_regex -- Case-insensitive regex match (~*)
    LIMIT 1;
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
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    NEW.raw_user_meta_data->>'avatar_url',
    v_university_id,
    v_roll_number,
    v_college_id
  )
  ON CONFLICT (id) DO UPDATE SET
    university_id_fk = EXCLUDED.university_id_fk,
    roll_number = EXCLUDED.roll_number,
    college_id = EXCLUDED.college_id;
    
  RETURN NEW;
END;
$$;
