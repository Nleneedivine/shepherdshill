
-- 1. Extend member_registrations
ALTER TABLE public.member_registrations
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS submission_method text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_member_id uuid,
  ADD COLUMN IF NOT EXISTS ai_completeness_score integer,
  ADD COLUMN IF NOT EXISTS ai_duplicate_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_family_match_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_cell_group_suggestion_id uuid,
  ADD COLUMN IF NOT EXISTS ai_processing_notes text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone_primary text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS membership_stage text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS member_registrations_phone_primary_key
  ON public.member_registrations (phone_primary)
  WHERE phone_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_registrations_status_idx ON public.member_registrations (verification_status);
CREATE INDEX IF NOT EXISTS member_registrations_submitted_at_idx ON public.member_registrations (submitted_at DESC);

-- Ensure RLS/grants (idempotent for existing table)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_registrations TO authenticated;
GRANT INSERT ON public.member_registrations TO anon;
GRANT ALL ON public.member_registrations TO service_role;
ALTER TABLE public.member_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a registration" ON public.member_registrations;
CREATE POLICY "Anyone can submit a registration"
  ON public.member_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view registrations" ON public.member_registrations;
CREATE POLICY "Admins can view registrations"
  ON public.member_registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update registrations" ON public.member_registrations;
CREATE POLICY "Admins can update registrations"
  ON public.member_registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.member_registrations;
CREATE POLICY "Admins can delete registrations"
  ON public.member_registrations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. Extend members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS membership_stage text,
  ADD COLUMN IF NOT EXISTS registration_id uuid REFERENCES public.member_registrations(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
CREATE POLICY "Admins can manage members"
  ON public.members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 3. member_biometrics
CREATE TABLE IF NOT EXISTS public.member_biometrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  face_template text,
  fingerprint_template text,
  qr_code text UNIQUE,
  has_qr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_biometrics TO authenticated;
GRANT ALL ON public.member_biometrics TO service_role;
ALTER TABLE public.member_biometrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage biometrics" ON public.member_biometrics;
CREATE POLICY "Admins manage biometrics" ON public.member_biometrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 4. spiritual_journey
CREATE TABLE IF NOT EXISTS public.spiritual_journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  status text NOT NULL,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spiritual_journey_member_idx ON public.spiritual_journey (member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spiritual_journey TO authenticated;
GRANT ALL ON public.spiritual_journey TO service_role;
ALTER TABLE public.spiritual_journey ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage spiritual journey" ON public.spiritual_journey;
CREATE POLICY "Admins manage spiritual journey" ON public.spiritual_journey FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 5. department_members
CREATE TABLE IF NOT EXISTS public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role_title text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_members TO authenticated;
GRANT ALL ON public.department_members TO service_role;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage department members" ON public.department_members;
CREATE POLICY "Admins manage department members" ON public.department_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 6. incomplete_profiles
CREATE TABLE IF NOT EXISTS public.incomplete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomplete_profiles TO authenticated;
GRANT ALL ON public.incomplete_profiles TO service_role;
ALTER TABLE public.incomplete_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage incomplete profiles" ON public.incomplete_profiles;
CREATE POLICY "Admins manage incomplete profiles" ON public.incomplete_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 7. system_logs
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid,
  performed_by_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON public.system_logs (created_at DESC);
GRANT SELECT, INSERT ON public.system_logs TO authenticated;
GRANT ALL ON public.system_logs TO service_role;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admins view logs" ON public.system_logs;
CREATE POLICY "Super admins view logs" ON public.system_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Authenticated insert logs" ON public.system_logs;
CREATE POLICY "Authenticated insert logs" ON public.system_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 8. updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_member_registrations_updated ON public.member_registrations;
CREATE TRIGGER trg_member_registrations_updated BEFORE UPDATE ON public.member_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_member_biometrics_updated ON public.member_biometrics;
CREATE TRIGGER trg_member_biometrics_updated BEFORE UPDATE ON public.member_biometrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_incomplete_profiles_updated ON public.incomplete_profiles;
CREATE TRIGGER trg_incomplete_profiles_updated BEFORE UPDATE ON public.incomplete_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. RPC approve_member_submission
CREATE OR REPLACE FUNCTION public.approve_member_submission(
  p_submission_id uuid,
  p_edited jsonb DEFAULT '{}'::jsonb,
  p_confirmed_cell_group_id uuid DEFAULT NULL
) RETURNS TABLE (member_id uuid, member_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.member_registrations%ROWTYPE;
  v_branch public.branches%ROWTYPE;
  v_year text := to_char(now(), 'YYYY');
  v_seq int;
  v_code text;
  v_member_id uuid;
  v_dept uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO s FROM public.member_registrations WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission not found'; END IF;
  IF s.created_member_id IS NOT NULL THEN
    SELECT m.id, m.member_code INTO member_id, member_code FROM public.members m WHERE m.id = s.created_member_id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_branch FROM public.branches WHERE id = COALESCE(s.branch_id, (SELECT id FROM public.branches ORDER BY created_at LIMIT 1)) LIMIT 1;
  IF v_branch.id IS NULL THEN RAISE EXCEPTION 'no branch configured'; END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(m.member_code, '^.*-(\d+)$', '\1'), '')::int), 0) + 1
    INTO v_seq
  FROM public.members m
  WHERE m.branch_id = v_branch.id AND m.member_code LIKE v_branch.branch_code || '-' || v_year || '-%';

  v_code := v_branch.branch_code || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.members (
    member_code, first_name, last_name, middle_name, preferred_name,
    dob, gender, phone_primary, phone_secondary, email,
    address, city, state, country, marital_status,
    membership_status, membership_stage, profile_photo_url,
    branch_id, cell_group_id, registration_id
  ) VALUES (
    v_code,
    COALESCE(s.first_name, s.personal->>'firstName'),
    COALESCE(s.last_name, s.personal->>'lastName'),
    s.personal->>'middleName',
    s.personal->>'preferredName',
    NULLIF(s.personal->>'dob','')::date,
    s.personal->>'gender',
    COALESCE(s.phone_primary, s.contact->>'phonePrimary'),
    s.contact->>'phoneSecondary',
    s.contact->>'email',
    s.contact->>'address',
    s.contact->>'city',
    s.contact->>'state',
    COALESCE(s.contact->>'country','Nigeria'),
    s.family->>'maritalStatus',
    'active',
    COALESCE(s.membership_stage, s.church_life->>'membershipStage'),
    s.profile_photo_url,
    v_branch.id,
    COALESCE(p_confirmed_cell_group_id, s.cell_group_id),
    s.id
  ) RETURNING id INTO v_member_id;

  INSERT INTO public.member_biometrics (member_id, qr_code, has_qr)
  VALUES (v_member_id, v_code, false);

  IF (s.spiritual->>'salvation') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'salvation', s.spiritual->>'salvation');
  END IF;
  IF (s.spiritual->>'baptised') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'baptised', s.spiritual->>'baptised');
  END IF;
  IF (s.spiritual->>'believersClass') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'believers_class', s.spiritual->>'believersClass');
  END IF;
  IF (s.spiritual->>'baptismalClass') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'baptismal_class', s.spiritual->>'baptismalClass');
  END IF;

  FOR v_dept IN SELECT (jsonb_array_elements_text(COALESCE(s.church_life->'departmentIds','[]'::jsonb)))::uuid LOOP
    INSERT INTO public.department_members (member_id, department_id, role_title)
    VALUES (v_member_id, v_dept, s.church_life->>'roleTitle')
    ON CONFLICT DO NOTHING;
  END LOOP;

  IF COALESCE(s.ai_completeness_score, s.completeness_score, 0) < 100 THEN
    INSERT INTO public.incomplete_profiles (member_id, completeness_score)
    VALUES (v_member_id, COALESCE(s.ai_completeness_score, s.completeness_score, 0))
    ON CONFLICT (member_id) DO UPDATE SET completeness_score = EXCLUDED.completeness_score;
  END IF;

  UPDATE public.member_registrations
    SET verification_status = 'approved',
        verified_by = v_uid,
        verified_at = now(),
        created_member_id = v_member_id
    WHERE id = s.id;

  member_id := v_member_id;
  member_code := v_code;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) TO authenticated;
