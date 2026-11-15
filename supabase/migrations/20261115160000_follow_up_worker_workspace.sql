-- Follow-Up Hub: personal worker workspace data.
-- Workers may only retrieve assignments assigned to their own authenticated account
-- and call reports they personally submitted. Team-wide reporting remains separate.

CREATE INDEX IF NOT EXISTS idx_follow_up_calls_called_by_date
  ON public.follow_up_calls(called_by, call_date DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_my_follow_up_assignments()
RETURNS TABLE (
  assignment_id uuid,
  member_id uuid,
  first_name text,
  last_name text,
  phone_primary text,
  address text,
  membership_stage text,
  cell_group_id uuid,
  member_created_at timestamptz,
  last_call_date timestamptz,
  no_answer_count bigint,
  last_stage_change timestamptz,
  last_call_outcome text,
  last_call_status text,
  next_follow_up_date date,
  is_overdue boolean,
  assignment_due_date date,
  assignment_notes text,
  assigned_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    m.id,
    m.first_name,
    m.last_name,
    m.phone_primary,
    m.address,
    m.membership_stage,
    m.cell_group_id,
    m.created_at,
    lc.call_date,
    COALESCE(na.call_count, 0)::bigint,
    ls.changed_at,
    lc.outcome,
    lc.status,
    a.due_date,
    (a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE),
    a.due_date,
    a.notes,
    a.created_at
  FROM public.follow_up_assignments a
  JOIN public.members m ON m.id = a.member_id
  LEFT JOIN LATERAL (
    SELECT fc.call_date, fc.outcome, fc.status
    FROM public.follow_up_calls fc
    WHERE fc.member_id = m.id
    ORDER BY fc.call_date DESC, fc.created_at DESC
    LIMIT 1
  ) lc ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS call_count
    FROM public.follow_up_calls fc
    WHERE fc.member_id = m.id
      AND fc.outcome = 'no_answer'
  ) na ON true
  LEFT JOIN LATERAL (
    SELECT msh.changed_at
    FROM public.member_stage_history msh
    WHERE msh.member_id = m.id
    ORDER BY msh.changed_at DESC
    LIMIT 1
  ) ls ON true
  WHERE a.assigned_to = v_uid
    AND a.status = 'open'
    AND m.membership_status = 'active'
  ORDER BY
    CASE WHEN a.due_date < CURRENT_DATE THEN 0
         WHEN a.due_date = CURRENT_DATE THEN 1
         WHEN a.due_date IS NULL THEN 3
         ELSE 2 END,
    a.due_date NULLS LAST,
    a.created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_follow_up_assignments()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_follow_up_assignments()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_follow_up_call_history(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  call_id uuid,
  member_id uuid,
  first_name text,
  last_name text,
  phone_primary text,
  membership_stage text,
  member_created_at timestamptz,
  call_date timestamptz,
  outcome text,
  status text,
  notes text,
  next_follow_up_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    fc.id,
    m.id,
    m.first_name,
    m.last_name,
    m.phone_primary,
    m.membership_stage,
    m.created_at,
    fc.call_date,
    fc.outcome,
    fc.status,
    fc.notes,
    fc.next_follow_up_date
  FROM public.follow_up_calls fc
  JOIN public.members m ON m.id = fc.member_id
  WHERE fc.called_by = v_uid
  ORDER BY fc.call_date DESC, fc.created_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_follow_up_call_history(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_follow_up_call_history(integer)
  TO authenticated;
