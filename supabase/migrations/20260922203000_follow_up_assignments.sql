-- Follow-Up Hub: assignment workflow for distributing follow-up work.

CREATE TABLE IF NOT EXISTS public.follow_up_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_follow_up_assignments_member
  ON public.follow_up_assignments(member_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_assignments_worker_status
  ON public.follow_up_assignments(assigned_to, status, due_date);

ALTER TABLE public.follow_up_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follow-up staff read assignments" ON public.follow_up_assignments;
DROP POLICY IF EXISTS "Follow-up staff manage assignments" ON public.follow_up_assignments;

CREATE POLICY "Follow-up staff read assignments"
ON public.follow_up_assignments
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.is_in_followup_department(auth.uid())
);

CREATE POLICY "Follow-up staff manage assignments"
ON public.follow_up_assignments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.is_in_followup_department(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.is_in_followup_department(auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.follow_up_assignments
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_follow_up_workers()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text
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
  SELECT DISTINCT
    p.id,
    COALESCE(NULLIF(trim(p.full_name), ''), p.email),
    p.email
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.id
  WHERE ur.role IN ('worker', 'pastoral_team', 'admin', 'super_admin')
  ORDER BY COALESCE(NULLIF(trim(p.full_name), ''), p.email);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_workers()
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.get_follow_up_workers()
TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_follow_up(
  p_member_id uuid,
  p_assigned_to uuid,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_assignment_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'super_admin')
    OR public.is_in_followup_department(v_uid)
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = p_member_id
      AND membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'active member not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = p_assigned_to
      AND ur.role IN ('worker', 'pastoral_team', 'admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'invalid follow-up worker';
  END IF;

  UPDATE public.follow_up_assignments
  SET status = 'reassigned',
      completed_at = COALESCE(completed_at, now())
  WHERE member_id = p_member_id
    AND status = 'open';

  INSERT INTO public.follow_up_assignments (
    member_id,
    assigned_to,
    assigned_by,
    due_date,
    notes
  )
  VALUES (
    p_member_id,
    p_assigned_to,
    v_uid,
    p_due_date,
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_follow_up(uuid, uuid, date, text)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.assign_follow_up(uuid, uuid, date, text)
TO authenticated;

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

REVOKE ALL ON FUNCTION public.complete_follow_up_assignment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_follow_up_assignment(uuid)
TO authenticated;
