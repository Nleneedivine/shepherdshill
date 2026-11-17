-- Worker-scoped visibility for recently completed follow-up assignments.
-- Kept separate from call history and from the existing active-assignment RPC.

CREATE OR REPLACE FUNCTION public.get_my_recent_completed_follow_up_assignments(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  assignment_id uuid,
  member_id uuid,
  first_name text,
  last_name text,
  membership_stage text,
  completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 90);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  SELECT a.id, m.id, m.first_name, m.last_name, m.membership_stage, a.completed_at
  FROM public.follow_up_assignments a
  JOIN public.members m ON m.id = a.member_id
  WHERE a.assigned_to = v_uid
    AND a.status = 'completed'
    AND a.completed_at IS NOT NULL
    AND a.completed_at >= now() - make_interval(days => v_days)
  ORDER BY a.completed_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_recent_completed_follow_up_assignments(integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_recent_completed_follow_up_assignments(integer, integer)
  TO authenticated;
