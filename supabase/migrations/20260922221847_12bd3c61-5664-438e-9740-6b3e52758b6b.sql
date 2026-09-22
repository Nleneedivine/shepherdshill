
CREATE OR REPLACE FUNCTION public.get_follow_up_queue_page(
  p_stage text DEFAULT 'all',
  p_search text DEFAULT NULL,
  p_contact_filter text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  member_id uuid,
  first_name text,
  last_name text,
  phone_primary text,
  address text,
  membership_stage text,
  cell_group_id uuid,
  member_created_at timestamp with time zone,
  last_call_date timestamp with time zone,
  last_call_outcome text,
  last_call_status text,
  no_answer_count bigint,
  last_stage_change timestamp with time zone,
  next_follow_up_date date,
  is_overdue boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  WITH base AS (
    SELECT * FROM public.get_follow_up_operational_queue() q
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE (p_stage IS NULL OR p_stage = 'all' OR b.membership_stage = p_stage)
      AND (
        p_search IS NULL OR p_search = ''
        OR (b.first_name || ' ' || b.last_name) ILIKE '%' || p_search || '%'
        OR COALESCE(b.phone_primary, '') ILIKE '%' || p_search || '%'
      )
      AND (
        p_contact_filter IS NULL OR p_contact_filter = 'all'
        OR (p_contact_filter = 'never_called' AND b.last_call_date IS NULL)
        OR (p_contact_filter = 'missed' AND b.no_answer_count > 0)
        OR (p_contact_filter = 'due_today' AND b.next_follow_up_date = CURRENT_DATE)
        OR (p_contact_filter = 'overdue' AND b.is_overdue)
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS n FROM filtered
  )
  SELECT
    f.member_id, f.first_name, f.last_name, f.phone_primary, f.address,
    f.membership_stage, f.cell_group_id, f.member_created_at,
    f.last_call_date, f.last_call_outcome, f.last_call_status,
    f.no_answer_count, f.last_stage_change, f.next_follow_up_date,
    f.is_overdue, c.n
  FROM filtered f CROSS JOIN counted c
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_queue_page(text, text, text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_queue_page(text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_follow_up_stage_counts()
RETURNS TABLE(
  first_timer bigint,
  consistent_visitor bigint,
  in_foundational bigint,
  member bigint,
  total bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    count(*) FILTER (WHERE m.membership_stage = 'first_timer')::bigint,
    count(*) FILTER (WHERE m.membership_stage = 'consistent_visitor')::bigint,
    count(*) FILTER (WHERE m.membership_stage = 'in_foundational')::bigint,
    count(*) FILTER (WHERE m.membership_stage = 'member')::bigint,
    count(*)::bigint
  FROM public.members m
  WHERE m.membership_status = 'active'
    AND m.membership_stage IN ('first_timer','consistent_visitor','in_foundational','member');
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_stage_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_stage_counts() TO authenticated;
