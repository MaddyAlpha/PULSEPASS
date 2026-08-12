-- Create secure RPC functions for handling invite codes

CREATE OR REPLACE FUNCTION public.validate_admin_invite_code(p_code TEXT)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(a)
  FROM (
    SELECT c.code, c.college_id, c.role, c.is_used, col.university_id, col.roll_number_regex, col.roll_number_format_hint
    FROM public.admin_invite_codes c
    LEFT JOIN public.colleges col ON c.college_id = col.id
    WHERE c.code = p_code AND c.is_used = false
  ) a;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_invite_code(p_code TEXT, p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_invite_codes
  SET is_used = true, used_by = p_user_id
  WHERE code = p_code;
$$;
