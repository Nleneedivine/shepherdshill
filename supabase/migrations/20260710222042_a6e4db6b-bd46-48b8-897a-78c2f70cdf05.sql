
-- ============================================================================
-- SPRINT A: user role management
-- ============================================================================

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Admins and super admins need to read all role rows for the user management page.
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Admins and super admins can see every profile (for the user list).
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ---------------------------------------------------------------------------
-- assign_user_role: single source of truth for role changes.
-- Enforces: super_admin can grant anything; admin can grant admin/worker/member only;
--           self-demotion blocked; every change logged.
-- The function inserts the new role row, deletes any conflicting existing rows
-- for administrative roles (member/first_timer/worker/pastoral_team/senior_pastor/admin/super_admin),
-- and updates profiles.is_super_admin accordingly.
-- ---------------------------------------------------------------------------
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

  -- Admins cannot grant super_admin
  IF p_new_role = 'super_admin' AND NOT v_is_super THEN
    RAISE EXCEPTION 'forbidden: only a super admin can grant super_admin';
  END IF;

  -- Block self-demotion (any change to your own role by yourself)
  IF v_uid = p_target_user_id THEN
    RAISE EXCEPTION 'forbidden: you cannot change your own role';
  END IF;

  -- Track whether target currently has super_admin (for logging + profile flip)
  SELECT public.has_role(p_target_user_id, 'super_admin') INTO v_target_was_super;

  -- Remove existing "primary" role rows so a user has one active primary role
  DELETE FROM public.user_roles
    WHERE user_id = p_target_user_id
      AND role IN ('member','first_timer','worker','pastoral_team','senior_pastor','admin','super_admin');

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by, assigned_at)
  VALUES (p_target_user_id, p_new_role, p_branch_id, v_uid, now());

  -- Keep profiles.is_super_admin mirror in sync
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

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- grant_super_admin_by_email: seed-time helper. Runs as security definer,
-- but is NOT callable by regular clients (execute revoked from public).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_super_admin_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_branch_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'user not found for email %', p_email;
    RETURN NULL;
  END IF;

  SELECT id INTO v_branch_id FROM public.branches ORDER BY created_at LIMIT 1;

  INSERT INTO public.profiles (id, email, is_super_admin)
  VALUES (v_user_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET is_super_admin = true, updated_at = now();

  DELETE FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN ('member','first_timer','worker','pastoral_team','senior_pastor','admin','super_admin');

  INSERT INTO public.user_roles (user_id, role, branch_id, assigned_by, assigned_at)
  VALUES (v_user_id, 'super_admin', v_branch_id, v_user_id, now());

  INSERT INTO public.system_logs (action, performed_by_name, details)
  VALUES (
    'grant_super_admin',
    'system_setup',
    jsonb_build_object('email', p_email, 'user_id', v_user_id)
  );

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_super_admin_by_email(text) FROM PUBLIC;
-- Not granted to authenticated on purpose; only invocable via SQL editor or service role.

-- Seed the two developer accounts (no-op when user doesn't exist yet).
SELECT public.grant_super_admin_by_email('nleneeletura@gmail.com');
SELECT public.grant_super_admin_by_email('info.nextgenrobot@gmail.com');

-- ============================================================================
-- SPRINT B: realtime + notification prefs
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_notification_channel text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS notification_opt_out boolean NOT NULL DEFAULT false;

ALTER TABLE public.member_registrations REPLICA IDENTITY FULL;
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.system_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'member_registrations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.member_registrations';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.members';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs';
  END IF;
END $$;

-- ============================================================================
-- SPRINT C: members list support
-- ============================================================================

ALTER TABLE public.member_biometrics
  ADD COLUMN IF NOT EXISTS has_face boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_fingerprint boolean NOT NULL DEFAULT false;

-- Read-access for senior pastors / pastoral team on department memberships (currently admin/super only)
DROP POLICY IF EXISTS "Pastoral read department members" ON public.department_members;
CREATE POLICY "Pastoral read department members" ON public.department_members
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'pastoral_team')
    OR public.has_role(auth.uid(),'senior_pastor')
  );

DROP POLICY IF EXISTS "Pastoral read biometrics" ON public.member_biometrics;
CREATE POLICY "Pastoral read biometrics" ON public.member_biometrics
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'pastoral_team')
    OR public.has_role(auth.uid(),'senior_pastor')
  );
