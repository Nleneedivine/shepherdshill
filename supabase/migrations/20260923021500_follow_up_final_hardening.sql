-- Follow-Up Hub: final workflow + scale hardening.
-- Adds fast latest-call/stage indexes and assignment visibility/completion.
-- Run this migration in Supabase SQL Editor after the GitHub sync.

CREATE INDEX IF NOT EXISTS idx_follow_up_calls_member_date
  ON public.follow_up_calls(member_id, call_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_calls_no_answer_member
  ON public.follow_up_calls(member_id)
  WHERE outcome = 'no_answer';

CREATE INDEX IF NOT EXISTS idx_member_stage_history_member_changed
  ON public.member_stage_history(member_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_members_active_stage_created
  ON public.members(membership_status, membership_stage, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_follow_up_current_assignment(
  p_member_id uuid
)
RETURNS TABLE(
  id uuid,
  assigned_to uuid,
  worker_name text,
  worker_email text,
  due_date date,
  status text,
  notes text,
  created_at timestamptz
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
    OR EXISTS (
      SELECT 1 FROM public.follow_up_assignments a
      WHERE a.member_id = p_member_id AND a.assigned_to = v_uid AND a.status = 'open'
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.assigned_to,
    COALESCE(NULLIF(trim(p.full_name), ''), p.email),
    p.email,
    a.due_date,
    a.status,
    a.notes,
    a.created_at
  FROM public.follow_up_assignments a
  LEFT JOIN public.profiles p ON p.id = a.assigned_to
  WHERE a.member_id = p_member_id
    AND a.status = 'open'
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_current_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_current_assignment(uuid) TO authenticated;

-- Keep the assignment actor auditable while allowing auth users to be removed.
ALTER TABLE public.follow_up_assignments
  DROP CONSTRAINT IF EXISTS follow_up_assignments_assigned_by_fkey;

ALTER TABLE public.follow_up_assignments
  ALTER COLUMN assigned_by DROP NOT NULL;

ALTER TABLE public.follow_up_assignments
  ADD CONSTRAINT follow_up_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.complete_follow_up_assignment(
  p_assignment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.follow_up_assignments
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_assignment_id
    AND status = 'open'
    AND (
      assigned_to = v_uid
      OR public.has_role(v_uid, 'admin')
      OR public.has_role(v_uid, 'super_admin')
      OR public.is_in_followup_department(v_uid)
    );

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_follow_up_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_follow_up_assignment(uuid) TO authenticated;

-- Faster queue implementation: fetch only each member's latest call and stage event
-- instead of aggregating the entire calls/history tables on every page request.
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
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_stage NOT IN ('first_timer','consistent_visitor','in_foundational','member','all') THEN
    RAISE EXCEPTION 'invalid follow-up stage';
  END IF;

  IF COALESCE(p_contact_filter, 'all') NOT IN ('all','never_called','missed','due_today','overdue') THEN
    RAISE EXCEPTION 'invalid follow-up contact filter';
  END IF;

  RETURN QUERY
  WITH base AS (
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
    LEFT JOIN LATERAL (
      SELECT fc.call_date, fc.outcome, fc.status, fc.next_follow_up_date
      FROM public.follow_up_calls fc
      WHERE fc.member_id = m.id
      ORDER BY fc.call_date DESC, fc.created_at DESC
      LIMIT 1
    ) lc ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::bigint AS count
      FROM public.follow_up_calls fc
      WHERE fc.member_id = m.id AND fc.outcome = 'no_answer'
    ) na ON true
    LEFT JOIN LATERAL (
      SELECT msh.changed_at
      FROM public.member_stage_history msh
      WHERE msh.member_id = m.id
      ORDER BY msh.changed_at DESC
      LIMIT 1
    ) ls ON true
    WHERE m.membership_status = 'active'
      AND (p_stage = 'all' OR m.membership_stage = p_stage)
      AND (
        v_search IS NULL
        OR m.first_name ILIKE '%' || v_search || '%'
        OR m.middle_name ILIKE '%' || v_search || '%'
        OR m.last_name ILIKE '%' || v_search || '%'
        OR m.preferred_name ILIKE '%' || v_search || '%'
        OR m.member_code ILIKE '%' || v_search || '%'
        OR COALESCE(m.phone_primary, '') ILIKE '%' || v_search || '%'
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
    SELECT base.*, count(*) OVER () AS total_count FROM base
  )
  SELECT
    counted.member_id, counted.first_name, counted.last_name, counted.phone_primary,
    counted.address, counted.membership_stage, counted.cell_group_id,
    counted.member_created_at, counted.last_call_date, counted.last_call_outcome,
    counted.last_call_status, counted.no_answer_count, counted.last_stage_change,
    counted.next_follow_up_date, counted.is_overdue, counted.total_count
  FROM counted
  ORDER BY
    CASE
      WHEN counted.membership_stage = 'first_timer' THEN 0
      WHEN counted.is_overdue THEN 1
      WHEN counted.next_follow_up_date = CURRENT_DATE THEN 2
      WHEN counted.next_follow_up_date IS NULL AND counted.last_call_date IS NULL THEN 3
      ELSE 4
    END,
    CASE WHEN counted.membership_stage = 'first_timer' THEN counted.member_created_at END DESC,
    counted.member_created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_queue_page(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_queue_page(text, text, text, integer, integer) TO authenticated;
