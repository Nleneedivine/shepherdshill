-- Follow-Up Hub: operational queue and controlled member stage progression.

CREATE OR REPLACE FUNCTION public.get_follow_up_operational_queue()
RETURNS TABLE(
  member_id uuid,
  first_name text,
  last_name text,
  phone_primary text,
  address text,
  membership_stage text,
  cell_group_id uuid,
  member_created_at timestamptz,
  last_call_date timestamptz,
  last_call_outcome text,
  last_call_status text,
  no_answer_count bigint,
  last_stage_change timestamptz,
  next_follow_up_date date,
  is_overdue boolean
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
  WITH latest_calls AS (
    SELECT DISTINCT ON (fc.member_id)
      fc.member_id,
      fc.call_date,
      fc.outcome,
      fc.status,
      fc.next_follow_up_date
    FROM public.follow_up_calls fc
    ORDER BY fc.member_id, fc.call_date DESC, fc.created_at DESC
  ),
  no_answers AS (
    SELECT fc.member_id, count(*)::bigint AS count
    FROM public.follow_up_calls fc
    WHERE fc.outcome = 'no_answer'
    GROUP BY fc.member_id
  ),
  latest_stage AS (
    SELECT DISTINCT ON (msh.member_id)
      msh.member_id,
      msh.changed_at
    FROM public.member_stage_history msh
    ORDER BY msh.member_id, msh.changed_at DESC
  )
  SELECT
    m.id,
    m.first_name,
    m.last_name,
    m.phone_primary,
    m.address,
    m.membership_stage,
    m.cell_group_id,
    m.created_at,
    lc.call_date,
    lc.outcome,
    lc.status,
    COALESCE(na.count, 0),
    ls.changed_at,
    lc.next_follow_up_date,
    (lc.next_follow_up_date IS NOT NULL AND lc.next_follow_up_date < CURRENT_DATE)
  FROM public.members m
  LEFT JOIN latest_calls lc ON lc.member_id = m.id
  LEFT JOIN no_answers na ON na.member_id = m.id
  LEFT JOIN latest_stage ls ON ls.member_id = m.id
  WHERE m.membership_status = 'active'
    AND m.membership_stage IN (
      'first_timer',
      'consistent_visitor',
      'in_foundational',
      'member'
    )
  ORDER BY
    CASE
      WHEN lc.next_follow_up_date IS NOT NULL AND lc.next_follow_up_date < CURRENT_DATE THEN 0
      WHEN lc.next_follow_up_date = CURRENT_DATE THEN 1
      WHEN lc.next_follow_up_date IS NULL AND lc.call_date IS NULL THEN 2
      ELSE 3
    END,
    COALESCE(lc.next_follow_up_date, CURRENT_DATE),
    m.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_operational_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_operational_queue() TO authenticated;


CREATE OR REPLACE FUNCTION public.update_follow_up_stage(
  p_member_id uuid,
  p_new_stage text
)
RETURNS TABLE(
  member_id uuid,
  old_stage text,
  new_stage text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old_stage text;
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_new_stage NOT IN (
    'first_timer',
    'consistent_visitor',
    'in_foundational',
    'member'
  ) THEN
    RAISE EXCEPTION 'invalid follow-up stage';
  END IF;

  SELECT m.membership_stage
  INTO v_old_stage
  FROM public.members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member not found';
  END IF;

  IF v_old_stage IS NOT DISTINCT FROM p_new_stage THEN
    RETURN QUERY SELECT p_member_id, v_old_stage, p_new_stage;
    RETURN;
  END IF;

  UPDATE public.members
  SET membership_stage = p_new_stage,
      updated_at = now()
  WHERE id = p_member_id;

  INSERT INTO public.member_stage_history (
    member_id,
    old_stage,
    new_stage,
    changed_at
  )
  VALUES (
    p_member_id,
    v_old_stage,
    p_new_stage,
    now()
  );

  RETURN QUERY SELECT p_member_id, v_old_stage, p_new_stage;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_follow_up_stage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_follow_up_stage(uuid, text) TO authenticated;
