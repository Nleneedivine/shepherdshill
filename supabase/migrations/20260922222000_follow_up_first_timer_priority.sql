-- Follow-Up Hub: scale-first first-timer queue.
-- Keeps first timers easy to reach even when the member database is very large.

CREATE OR REPLACE FUNCTION public.get_follow_up_queue_page(
  p_stage text DEFAULT 'first_timer',
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
  member_created_at timestamptz,
  last_call_date timestamptz,
  last_call_outcome text,
  last_call_status text,
  no_answer_count bigint,
  last_stage_change timestamptz,
  next_follow_up_date date,
  is_overdue boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_stage NOT IN (
    'first_timer',
    'consistent_visitor',
    'in_foundational',
    'member',
    'all'
  ) THEN
    RAISE EXCEPTION 'invalid follow-up stage';
  END IF;

  IF COALESCE(p_contact_filter, 'all') NOT IN ('all', 'never_called', 'missed', 'due_today', 'overdue') THEN
    RAISE EXCEPTION 'invalid follow-up contact filter';
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
  ),
  base AS (
    SELECT
      m.id AS member_id,
      m.first_name,
      m.last_name,
      m.phone_primary,
      m.address,
      m.membership_stage,
      m.cell_group_id,
      m.created_at AS member_created_at,
      lc.call_date AS last_call_date,
      lc.outcome AS last_call_outcome,
      lc.status AS last_call_status,
      COALESCE(na.count, 0)::bigint AS no_answer_count,
      ls.changed_at AS last_stage_change,
      lc.next_follow_up_date,
      (lc.next_follow_up_date IS NOT NULL AND lc.next_follow_up_date < CURRENT_DATE) AS is_overdue
    FROM public.members m
    LEFT JOIN latest_calls lc ON lc.member_id = m.id
    LEFT JOIN no_answers na ON na.member_id = m.id
    LEFT JOIN latest_stage ls ON ls.member_id = m.id
    WHERE m.membership_status = 'active'
      AND (
        p_stage = 'all'
        OR m.membership_stage = p_stage
      )
      AND (
        NULLIF(trim(COALESCE(p_search, '')), '') IS NULL
        OR concat_ws(' ', m.first_name, m.last_name) ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(m.phone_primary, '') ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        COALESCE(p_contact_filter, 'all') = 'all'
        OR (p_contact_filter = 'never_called' AND lc.call_date IS NULL)
        OR (p_contact_filter = 'missed' AND COALESCE(na.count, 0) > 0)
        OR (p_contact_filter = 'due_today' AND lc.next_follow_up_date = CURRENT_DATE)
        OR (p_contact_filter = 'overdue' AND lc.next_follow_up_date < CURRENT_DATE)
      )
  ),
  counted AS (
    SELECT base.*, count(*) OVER () AS total_count
    FROM base
  )
  SELECT
    counted.member_id,
    counted.first_name,
    counted.last_name,
    counted.phone_primary,
    counted.address,
    counted.membership_stage,
    counted.cell_group_id,
    counted.member_created_at,
    counted.last_call_date,
    counted.last_call_outcome,
    counted.last_call_status,
    counted.no_answer_count,
    counted.last_stage_change,
    counted.next_follow_up_date,
    counted.is_overdue,
    counted.total_count
  FROM counted
  ORDER BY
    CASE
      WHEN counted.membership_stage = 'first_timer' THEN 0
      WHEN counted.is_overdue THEN 1
      WHEN counted.next_follow_up_date = CURRENT_DATE THEN 2
      WHEN counted.next_follow_up_date IS NULL AND counted.last_call_date IS NULL THEN 3
      ELSE 4
    END,
    counted.member_created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_queue_page(text, text, text, integer, integer) FROM PUBLIC, anon;
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
    count(*) FILTER (WHERE membership_stage = 'first_timer'),
    count(*) FILTER (WHERE membership_stage = 'consistent_visitor'),
    count(*) FILTER (WHERE membership_stage = 'in_foundational'),
    count(*) FILTER (WHERE membership_stage = 'member'),
    count(*)
  FROM public.members
  WHERE membership_status = 'active'
    AND membership_stage IN (
      'first_timer',
      'consistent_visitor',
      'in_foundational',
      'member'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_stage_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_stage_counts() TO authenticated;
