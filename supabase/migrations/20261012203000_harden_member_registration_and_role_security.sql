-- Security hardening: member access, role assignment, and public registration intake.
-- Apply only after testing these permissions against all supported roles in staging.

BEGIN;

-- The original permissive policies remain effective unless explicitly removed:
-- permissive RLS policies are OR-ed together.
DROP POLICY IF EXISTS "Auth users read members" ON public.members;
DROP POLICY IF EXISTS "Admins manage members" ON public.members;

-- Keep the newer "Members read own or admins read all" and
-- "Admins can manage members" policies as the intended access boundaries.

-- Registration submissions must go through submit-registration, which verifies
-- authentication, Turnstile, validates fields, and applies server-side rate limits.
DROP POLICY IF EXISTS "Anyone can submit registration" ON public.member_registrations;
DROP POLICY IF EXISTS "Anyone can submit a registration" ON public.member_registrations;
REVOKE INSERT ON public.member_registrations FROM anon, authenticated;
GRANT INSERT ON public.member_registrations TO service_role;

-- Support the rolling one-hour count without a full table scan.
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip_created_at
  ON public.registration_attempts (ip_address, created_at DESC);

-- Serialize attempts by IP and authenticated user so concurrent requests cannot
-- all pass a count-then-insert rate limit at once.
CREATE OR REPLACE FUNCTION public.consume_registration_rate_limit(
  p_ip_address text,
  p_user_id uuid,
  p_max_attempts integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_key text := COALESCE(NULLIF(p_ip_address, ''), 'unknown');
  v_user_key text := 'user:' || p_user_id::text;
  v_ip_count integer;
  v_user_count integer;
BEGIN
  IF p_user_id IS NULL OR p_max_attempts < 1 OR p_max_attempts > 20 THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;

  -- Acquire locks in a consistent order to avoid deadlocks.
  PERFORM pg_advisory_xact_lock(hashtext('registration-ip:' || v_ip_key));
  PERFORM pg_advisory_xact_lock(hashtext('registration-user:' || p_user_id::text));

  SELECT count(*) INTO v_ip_count
  FROM public.registration_attempts
  WHERE ip_address = v_ip_key
    AND created_at >= now() - interval '1 hour';

  SELECT count(*) INTO v_user_count
  FROM public.registration_attempts
  WHERE ip_address = v_user_key
    AND created_at >= now() - interval '1 hour';

  IF v_ip_count >= p_max_attempts OR v_user_count >= p_max_attempts THEN
    RETURN false;
  END IF;

  INSERT INTO public.registration_attempts (ip_address) VALUES (v_ip_key), (v_user_key);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_registration_rate_limit(text, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_registration_rate_limit(text, uuid, integer)
  TO service_role;

-- Harden role assignment: admin callers may grant only admin/worker/member,
-- may not alter a super-admin, and cannot assign roles to themselves.
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_target_user_id uuid,
  p_new_role public.app_role,
  p_branch_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_is_admin boolean;
  v_target_was_super boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_is_super := public.has_role(v_uid, 'super_admin');
  v_is_admin := public.has_role(v_uid, 'admin');

  IF NOT (v_is_super OR v_is_admin) THEN
    RAISE EXCEPTION 'forbidden: only admins or super admins may assign roles';
  END IF;

  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'forbidden: you cannot change your own role';
  END IF;

  SELECT public.has_role(p_target_user_id, 'super_admin')
    INTO v_target_was_super;

  IF NOT v_is_super THEN
    IF p_new_role NOT IN ('admin'::public.app_role, 'worker'::public.app_role, 'member'::public.app_role) THEN
      RAISE EXCEPTION 'forbidden: admins may grant only admin, worker, or member roles';
    END IF;
    IF v_target_was_super THEN
      RAISE EXCEPTION 'forbidden: only a super admin may modify a super-admin account';
    END IF;
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user is required';
  END IF;

  -- Remove the known primary-role set while preserving secondary team roles.
  -- Include newer pastoral hierarchy roles so a demotion cannot leave a higher
  -- primary role active behind the newly assigned role.
  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id
    AND role IN (
      'member','first_timer','visitor','volunteer','worker','pastoral_team',
      'senior_pastor','provincial_pastor','zonal_pastor','area_supervisor',
      'parish_pastor','counselling_pastor','finance_director','department_head','cell_leader',
      'prayer_coordinator','admin','super_admin'
    );

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by, assigned_at)
  VALUES (p_target_user_id, p_new_role, p_branch_id, v_uid, now());

  UPDATE public.profiles
  SET is_super_admin = (p_new_role = 'super_admin'),
      updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.system_logs (action, performed_by, performed_by_name, details)
  VALUES (
    'assign_user_role',
    v_uid,
    (SELECT COALESCE(full_name, email) FROM public.profiles WHERE id = v_uid),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'new_role', p_new_role::text,
      'previous_was_super_admin', v_target_was_super,
      'branch_id', p_branch_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) TO authenticated;

COMMIT;
