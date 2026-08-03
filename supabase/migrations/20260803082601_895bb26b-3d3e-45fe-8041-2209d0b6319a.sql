CREATE OR REPLACE FUNCTION public.approve_member_submission(p_submission_id uuid, p_edited jsonb DEFAULT '{}'::jsonb, p_confirmed_cell_group_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(member_id uuid, member_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
$function$;

REVOKE ALL ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) TO authenticated;