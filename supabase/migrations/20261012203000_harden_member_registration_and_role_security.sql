-- Security hardening: member access, role assignment, and public registration intake.
-- Apply only after testing these permissions against all supported roles in staging.

BEGIN;

-- Protect profile authorization/identity fields from self-service mutation.
-- Keep the derived super-admin cache in sync with user_roles, allow a branch admin
-- to place an unassigned target into their own branch through assign_user_role,
-- and only allow member_id linkage to a member created from that user's registration.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_branch uuid;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'forbidden: cannot change profile id';
  END IF;

  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF NEW.is_super_admin IS DISTINCT FROM EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = NEW.id AND ur.role = 'super_admin'
    ) AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'forbidden: super-admin status is derived from user_roles';
    END IF;
  END IF;

  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    SELECT p.branch_id INTO v_actor_branch
    FROM public.profiles p
    WHERE p.id = auth.uid();

    IF NOT public.has_role(auth.uid(), 'admin')
       OR v_actor_branch IS NULL
       OR NEW.branch_id IS DISTINCT FROM v_actor_branch THEN
      RAISE EXCEPTION 'forbidden: cannot modify profile branch';
    END IF;
  END IF;

  IF NEW.member_id IS DISTINCT FROM OLD.member_id THEN
    IF NEW.member_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.members m
      JOIN public.member_registrations r ON r.id = m.registration_id
      WHERE m.id = NEW.member_id
        AND r.user_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'forbidden: member link must match the profile owner registration';
    END IF;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden: change account email through authentication settings';
  END IF;

  RETURN NEW;
END;
$$;

-- Prevent unauthenticated/anonymous audit-log spoofing. Existing client-side
-- logging can remain, but each row must be attributed to the authenticated caller.
DROP POLICY IF EXISTS "Authenticated insert logs" ON public.system_logs;
DROP POLICY IF EXISTS "Authenticated insert own logs" ON public.system_logs;
CREATE POLICY "Authenticated insert own logs"
  ON public.system_logs FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- The original permissive policies remain effective unless explicitly removed:
-- permissive RLS policies are OR-ed together.
DROP POLICY IF EXISTS "Auth users read members" ON public.members;
DROP POLICY IF EXISTS "Admins manage members" ON public.members;

-- Keep the newer "Members read own or admins read all" and
-- "Admins can manage members" policies as the intended access boundaries.

-- Anonymous form_drafts policies allowed any anon client to select/update/delete
-- every draft with a non-null session_id. The app now creates a real anonymous
-- Supabase auth user and keys drafts by auth.uid(), so anon-key-only table access
-- is unnecessary and must be removed to prevent cross-user draft disclosure.
DROP POLICY IF EXISTS "Anon inserts own session draft" ON public.form_drafts;
DROP POLICY IF EXISTS "Anon updates own session draft" ON public.form_drafts;
DROP POLICY IF EXISTS "Anon selects own session draft" ON public.form_drafts;
DROP POLICY IF EXISTS "Anon deletes own session draft" ON public.form_drafts;
REVOKE ALL ON public.form_drafts FROM anon;

-- Registration submissions must go through submit-registration, which verifies
-- authentication, Turnstile, validates fields, and applies server-side rate limits.
-- The application and profile-linking trigger already rely on this association;
-- add it idempotently so clean installs have the same schema as deployed instances.
ALTER TABLE public.member_registrations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

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
  v_actor_branch uuid;
  v_target_branch uuid;
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

  -- A regular admin is branch-scoped. Do not let an admin grant roles to
  -- another branch or create an unscoped role assignment.
  IF NOT v_is_super THEN
    SELECT branch_id INTO v_actor_branch
    FROM public.profiles
    WHERE id = v_uid;

    SELECT branch_id INTO v_target_branch
    FROM public.profiles
    WHERE id = p_target_user_id;

    IF v_actor_branch IS NULL THEN
      RAISE EXCEPTION 'forbidden: your admin account is not assigned to a branch';
    END IF;
    IF v_target_branch IS NOT NULL AND v_target_branch <> v_actor_branch THEN
      RAISE EXCEPTION 'forbidden: admins may manage users only in their own branch';
    END IF;
    IF p_branch_id IS NOT NULL AND p_branch_id <> v_actor_branch THEN
      RAISE EXCEPTION 'forbidden: admins may assign roles only within their own branch';
    END IF;

    p_branch_id := v_actor_branch;
  END IF;

  -- Use only labels present in the repository's declared public.app_role enum.
  -- Do not reference speculative hierarchy labels: PostgreSQL would reject the
  -- function definition if a listed enum label does not exist.
  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id
    AND role::text IN (
      'member','first_timer','visitor','volunteer','worker','pastoral_team',
      'senior_pastor','provincial_pastor','zonal_pastor','area_supervisor',
      'parish_pastor','counselling_pastor','finance_director','department_head',
      'cell_leader','prayer_coordinator','finance_team','media_team',
      'communications_team','facilities_team','it_team','protocol_team','usher',
      'admin','super_admin'
    );

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by, assigned_at)
  VALUES (p_target_user_id, p_new_role, p_branch_id, v_uid, now());

  UPDATE public.profiles
  SET is_super_admin = (p_new_role = 'super_admin'),
      branch_id = CASE
        WHEN NOT v_is_super THEN COALESCE(branch_id, v_actor_branch)
        ELSE branch_id
      END,
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
