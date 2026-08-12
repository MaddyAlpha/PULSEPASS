-- ============================================================
-- PulsePass — Update handle_new_user to include university & roll_number
-- Migration: 15_update_handle_new_user.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    avatar_url, 
    university_id_fk, 
    roll_number
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    NEW.raw_user_meta_data->>'avatar_url',
    (NEW.raw_user_meta_data->>'university_id_fk')::UUID,
    NEW.raw_user_meta_data->>'roll_number'
  )
  ON CONFLICT (id) DO UPDATE SET
    university_id_fk = EXCLUDED.university_id_fk,
    roll_number = EXCLUDED.roll_number;
  RETURN NEW;
END;
$$;
