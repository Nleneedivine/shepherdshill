-- Follow-Up Hub: add first timers directly and provide secure member history.

CREATE OR REPLACE FUNCTION public.add_first_timer(
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS TABLE(member_id uuid, member_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_year text := to_char(now(), 'YYYY');
  v_seq int;
  v_code text;
  v_member_id uuid;
  v_branch_id uuid;
  v_branch_code text;
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NULLIF(trim(p_first_name), '') IS NULL THEN
    RAISE EXCEPTION 'first name is required';
  END IF;

  IF NULLIF(trim(p_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'last name is required';
  END IF;

  -- Prevent two simultaneous registrations from receiving the same code.
  PERFORM pg_advisory_xact_lock(hashtext('member-code-' || v_year));

  SELECT id, branch_code
  INTO v_branch_id, v_branch_code
  FROM public.branches
  WHERE status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    SELECT id, branch_code INTO v_branch_id, v_branch_code
    FROM public.branches
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'no branch configured';
  END IF;

  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(m.member_code, '^.*-(\\d+)$', '\\1'), '')::int),
    0
  ) + 1
  INTO v_seq
  FROM public.members m
  WHERE m.member_code LIKE 'RCCG-SH-' || v_year || '-%';

  v_code := 'RCCG-SH-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.members (
    member_code,
    first_name,
    last_name,
    phone_primary,
    address,
    country,
    membership_status,
    membership_stage,
    branch_id
  )
  VALUES (
    v_code,
    trim(p_first_name),
    trim(p_last_name),
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_address), ''),
    'Nigeria',
    'active',
    'first_timer',
    v_branch_id
  )
  RETURNING id INTO v_member_id;

  INSERT INTO public.member_biometrics (member_id, qr_code, has_qr)
  VALUES (v_member_id, v_code, false);

  INSERT INTO public.member_stage_history (
    member_id,
    old_stage,
    new_stage,
    changed_at
  )
  VALUES (
    v_member_id,
    NULL,
    'first_timer',
    now()
  );

  RETURN QUERY SELECT v_member_id, v_code;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_first_timer(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_first_timer(text, text, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_follow_up_member_history(p_member_id uuid)
RETURNS TABLE(
  event_type text,
  event_at timestamptz,
  outcome text,
  status text,
  notes text,
  next_follow_up_date date,
  old_stage text,
  new_stage text,
  called_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    'call'::text,
    fc.call_date::timestamptz,
    fc.outcome,
    fc.status,
    fc.notes,
    fc.next_follow_up_date,
    NULL::text,
    NULL::text,
    fc.called_by
  FROM public.follow_up_calls fc
  WHERE fc.member_id = p_member_id

  UNION ALL

  SELECT
    'stage_change'::text,
    msh.changed_at,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::date,
    msh.old_stage,
    msh.new_stage,
    NULL::uuid
  FROM public.member_stage_history msh
  WHERE msh.member_id = p_member_id

  ORDER BY event_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_member_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_member_history(uuid) TO authenticated;
