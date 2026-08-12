-- Migration 12_architecture_refactor.sql

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE role_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. COLLEGE INVITE CODES (For Organiser Double-Lock)
CREATE TABLE IF NOT EXISTS public.college_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.college_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "college_invite_codes_select" ON public.college_invite_codes
  FOR SELECT USING (TRUE);

CREATE POLICY "college_invite_codes_insert" ON public.college_invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'college_admin' AND p.college_id = college_invite_codes.college_id) OR
      (p.role = 'university_admin' AND p.university_id_fk = college_invite_codes.university_id)
    ))
  );

CREATE POLICY "college_invite_codes_update" ON public.college_invite_codes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'college_admin' AND p.college_id = college_invite_codes.college_id) OR
      (p.role = 'university_admin' AND p.university_id_fk = college_invite_codes.university_id)
    ))
  );

-- 3. ROLE REQUESTS (Pending Organiser Applications)
CREATE TABLE IF NOT EXISTS public.role_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  status role_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, college_id)
);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_requests_select_own" ON public.role_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "role_requests_select_admin" ON public.role_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = role_requests.university_id)
    ))
  );

CREATE POLICY "role_requests_insert_student" ON public.role_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "role_requests_update_admin" ON public.role_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = role_requests.university_id)
    ))
  );

-- 4. UNIVERSITY BATCH CODES (For Smart CR Verification Routing)
CREATE TABLE IF NOT EXISTS public.university_batch_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  prefix_code TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(university_id, prefix_code)
);

ALTER TABLE public.university_batch_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_codes_select" ON public.university_batch_codes
  FOR SELECT USING (TRUE);

CREATE POLICY "batch_codes_all_admin" ON public.university_batch_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role = 'university_admin' AND p.university_id_fk = university_batch_codes.university_id)
    ))
  );

-- 5. COMMITTEES EXPANSION & UNIVERSITY REGEX
ALTER TABLE public.committees ADD COLUMN IF NOT EXISTS head_roll_number TEXT;
ALTER TABLE public.committees ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS roll_number_regex TEXT;

-- 6. COMMITTEE FINANCES (Ledger)
CREATE TABLE IF NOT EXISTS public.committee_finances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount DECIMAL(10, 2) NOT NULL,
  vendor_name TEXT,
  receipt_url TEXT,
  logged_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.committee_finances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finances_select" ON public.committee_finances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_finances.university_id)
    ))
  );

CREATE POLICY "finances_insert" ON public.committee_finances
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_finances.university_id)
    ))
  );

CREATE POLICY "finances_update" ON public.committee_finances
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_finances.university_id)
    ))
  );

CREATE POLICY "finances_delete" ON public.committee_finances
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_finances.university_id)
    ))
  );


-- 7. COMMITTEE LOGISTICS (Inventory)
CREATE TABLE IF NOT EXISTS public.committee_logistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  vendor_contact TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCURED', 'RETURNED')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.committee_logistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logistics_select" ON public.committee_logistics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_logistics.university_id)
    ))
  );

CREATE POLICY "logistics_insert" ON public.committee_logistics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_logistics.university_id)
    ))
  );

CREATE POLICY "logistics_update" ON public.committee_logistics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_logistics.university_id)
    ))
  );

CREATE POLICY "logistics_delete" ON public.committee_logistics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR 
      (p.role::text IN ('university_admin', 'college_admin', 'organiser') AND p.university_id_fk = committee_logistics.university_id)
    ))
  );

CREATE TRIGGER logistics_updated_at BEFORE UPDATE ON public.committee_logistics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. EXPAND PROFILES FOR SMART CR
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cr_batch_prefix TEXT; -- For CRs specifically

