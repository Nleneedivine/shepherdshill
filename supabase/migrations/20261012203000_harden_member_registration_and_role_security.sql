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
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    v_actor_branch := public.current_user_branch();

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

-- Branch resolution is centralized so RLS policies and privileged functions use
-- the same scope. Super admins are global; other staff must have an assigned branch.
CREATE OR REPLACE FUNCTION public.current_user_branch()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT ur.branch_id FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.branch_id IS NOT NULL
     ORDER BY ur.assigned_at DESC NULLS LAST
     LIMIT 1)
  );
$function$;

REVOKE ALL ON FUNCTION public.current_user_branch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_branch() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_member(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'super_admin') THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.member_id = p_member_id
    ) THEN true
    WHEN public.is_pastoral(auth.uid()) THEN EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = p_member_id
        AND m.branch_id = public.current_user_branch()
    )
    ELSE false
  END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_member(uuid) TO authenticated, service_role;

-- Replace the later broad policies as well: RLS policies are OR-ed, so leaving
-- "Admins can manage members" or the pastoral read policy unchanged would undo
-- branch scoping even after removing the oldest permissive policy.
DROP POLICY IF EXISTS "Members read own or admins read all" ON public.members;
CREATE POLICY "Members read own or admins read all"
  ON public.members FOR SELECT TO authenticated
  USING (public.can_access_member(id));

DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
CREATE POLICY "Admins can manage members"
  ON public.members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );


-- The old public cell-group SELECT policy exposed every column, including
-- leader phone numbers and private meeting addresses. Keep public registration
-- lookup on a narrow view and require staff/linked members for base-table access.
DROP POLICY IF EXISTS "Cell groups readable by all" ON public.cell_groups;
REVOKE ALL ON public.cell_groups FROM anon;
CREATE POLICY "Staff and linked members read cell groups"
  ON public.cell_groups FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_staff(auth.uid()) AND branch_id = public.current_user_branch())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.members m ON m.id = p.member_id
      WHERE p.id = auth.uid() AND m.cell_group_id = cell_groups.id
    )
  );

CREATE OR REPLACE VIEW public.public_cell_group_options
WITH (security_barrier = true)
AS
SELECT id, name, leader_name, meeting_day, meeting_time, branch_id, parish_id, is_active
FROM public.cell_groups
WHERE is_active = true;

GRANT SELECT ON public.public_cell_group_options TO anon, authenticated;

-- Scope branch-owned configuration writes. Global hierarchy records have no
-- branch_id and are therefore managed only by super admins; branch-owned
-- departments, cell groups and parishes can be changed only inside the caller's branch.
DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins manage cell groups" ON public.cell_groups;
CREATE POLICY "Admins manage cell groups"
  ON public.cell_groups FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins manage parishes" ON public.parishes;
CREATE POLICY "Admins manage parishes"
  ON public.parishes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins manage provinces" ON public.provinces;
CREATE POLICY "Super admins manage provinces"
  ON public.provinces FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage zones" ON public.zones;
CREATE POLICY "Super admins manage zones"
  ON public.zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage areas" ON public.areas;
CREATE POLICY "Super admins manage areas"
  ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Remove the legacy storage read policy that allowed anon/authenticated
-- clients to read every object in the member-photos bucket. The later staff
-- policies are the intended access boundary; permissive policies are OR-ed.
DROP POLICY IF EXISTS "member-photos read authenticated" ON storage.objects;

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

-- Scope registration and account metadata to the user's branch. Branchless
-- registrations remain visible to super admins only until a branch is assigned.
DROP POLICY IF EXISTS "Admins read registrations" ON public.member_registrations;
DROP POLICY IF EXISTS "Admins can view registrations" ON public.member_registrations;
CREATE POLICY "Admins can view registrations"
  ON public.member_registrations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_pastoral(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins update registrations" ON public.member_registrations;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.member_registrations;
CREATE POLICY "Admins can update registrations"
  ON public.member_registrations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.member_registrations;
CREATE POLICY "Admins can delete registrations"
  ON public.member_registrations FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND branch_id = public.current_user_branch())
  );

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND (
      branch_id = public.current_user_branch()
      OR branch_id IS NULL
      OR id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND (
          COALESCE(p.branch_id, user_roles.branch_id) = public.current_user_branch()
          OR (p.branch_id IS NULL AND user_roles.branch_id IS NULL)
        )
    ))
  );

DROP POLICY IF EXISTS "Admins view all form drafts" ON public.form_drafts;
CREATE POLICY "Admins view all form drafts"
  ON public.form_drafts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = form_drafts.user_id
        AND p.branch_id = public.current_user_branch()
    ))
  );

DROP POLICY IF EXISTS "Admins delete abandoned drafts" ON public.form_drafts;
CREATE POLICY "Admins delete abandoned drafts"
  ON public.form_drafts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = form_drafts.user_id
        AND p.branch_id = public.current_user_branch()
    ))
  );

DROP POLICY IF EXISTS "Super admins view logs" ON public.system_logs;
CREATE POLICY "Super admins view logs"
  ON public.system_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR performed_by = auth.uid());

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

  -- Do not assign privileged roles to anonymous auth sessions, which intentionally
  -- have no profile row. Every role-managed account must have a real profile.
  PERFORM 1 FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target profile not found';
  END IF;

  -- A regular admin is branch-scoped. Do not let an admin grant roles to
  -- another branch or create an unscoped role assignment.
  IF NOT v_is_super THEN
    v_actor_branch := public.current_user_branch();

    SELECT COALESCE(
      p.branch_id,
      (SELECT ur.branch_id
       FROM public.user_roles ur
       WHERE ur.user_id = p.id AND ur.branch_id IS NOT NULL
       ORDER BY ur.assigned_at DESC NULLS LAST
       LIMIT 1)
    )
    INTO v_target_branch
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

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
      'cell_leader','prayer_coordinator','admin','super_admin'
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

CREATE OR REPLACE FUNCTION public.approve_member_submission(p_submission_id uuid, p_edited jsonb DEFAULT '{}'::jsonb, p_confirmed_cell_group_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(member_id uuid, member_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  s public.member_registrations%ROWTYPE;
  v_branch public.branches%ROWTYPE;
  v_year text := to_char(now(), 'YYYY');
  v_seq int;
  v_code text;
  v_prefix text := 'RCCG-SH';
  v_member_id uuid;
  v_dept uuid;
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_actor_branch uuid;
  v_cell_group_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_is_super := public.has_role(v_uid, 'super_admin');

  SELECT * INTO s FROM public.member_registrations WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission not found'; END IF;

  IF NOT v_is_super THEN
    v_actor_branch := public.current_user_branch();
    IF v_actor_branch IS NULL THEN
      RAISE EXCEPTION 'forbidden: your admin account is not assigned to a branch';
    END IF;
    IF s.branch_id IS NULL THEN
      RAISE EXCEPTION 'forbidden: assign a branch before a branch admin approves this registration';
    END IF;
    IF s.branch_id <> v_actor_branch THEN
      RAISE EXCEPTION 'forbidden: admins may approve registrations only in their own branch';
    END IF;
    IF s.created_member_id IS NOT NULL THEN
      PERFORM 1 FROM public.members
      WHERE id = s.created_member_id AND branch_id = v_actor_branch;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'forbidden: registration belongs to another branch';
      END IF;
    END IF;
  END IF;

  IF s.created_member_id IS NOT NULL THEN
    SELECT m.id, m.member_code INTO member_id, member_code
    FROM public.members m WHERE m.id = s.created_member_id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_branch
  FROM public.branches
  WHERE id = COALESCE(
    s.branch_id,
    CASE WHEN v_is_super THEN
      (SELECT id FROM public.branches ORDER BY created_at LIMIT 1)
    ELSE v_actor_branch END
  )
  LIMIT 1;
  IF v_branch.id IS NULL THEN RAISE EXCEPTION 'no branch configured'; END IF;

  v_cell_group_id := COALESCE(p_confirmed_cell_group_id, s.cell_group_id);
  IF v_cell_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cell_groups cg
    WHERE cg.id = v_cell_group_id
      AND (cg.branch_id = v_branch.id OR cg.branch_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'cell group does not belong to the selected branch';
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(m.member_code, '^.*-(\d+)$', '\1'), '')::int), 0) + 1
    INTO v_seq
  FROM public.members m
  WHERE m.member_code LIKE v_prefix || '-' || v_year || '-%';

  v_code := v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.members (
    member_code, first_name, last_name, middle_name, preferred_name,
    dob, gender, phone_primary, phone_secondary, email,
    address, city, state, country, marital_status,
    membership_status, membership_stage, profile_photo_url,
    branch_id, cell_group_id, registration_id
  ) VALUES (
    v_code,
    COALESCE(s.first_name, s.personal->>'firstName'),
    COALESCE(s.last_name, s.personal->>'lastName'),
    s.personal->>'middleName',
    s.personal->>'preferredName',
    NULLIF(COALESCE(s.personal->>'dateOfBirth', s.personal->>'dob'),'')::date,
    s.personal->>'gender',
    COALESCE(s.phone_primary, s.contact->>'phonePrimary'),
    s.contact->>'phoneSecondary',
    s.contact->>'email',
    s.contact->>'address',
    s.contact->>'city',
    s.contact->>'state',
    COALESCE(s.contact->>'country','Nigeria'),
    s.family->>'maritalStatus',
    'active',
    COALESCE(s.membership_stage, s.church_life->>'membershipStage'),
    s.profile_photo_url,
    v_branch.id,
    v_cell_group_id,
    s.id
  ) RETURNING id INTO v_member_id;

  INSERT INTO public.member_biometrics (member_id, qr_code, has_qr)
  VALUES (v_member_id, v_code, false);

  IF (s.spiritual->>'salvation') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'salvation', s.spiritual->>'salvation');
  END IF;
  IF (s.spiritual->>'baptised') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'baptised', s.spiritual->>'baptised');
  END IF;
  IF (s.spiritual->>'believersClass') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'believers_class', s.spiritual->>'believersClass');
  END IF;
  IF (s.spiritual->>'baptismalClass') IS NOT NULL THEN
    INSERT INTO public.spiritual_journey (member_id, milestone, status) VALUES (v_member_id, 'baptismal_class', s.spiritual->>'baptismalClass');
  END IF;

  FOR v_dept IN SELECT (jsonb_array_elements_text(COALESCE(s.church_life->'departmentIds','[]'::jsonb)))::uuid LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = v_dept AND (d.branch_id = v_branch.id OR d.branch_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'department does not belong to the selected branch';
    END IF;

    INSERT INTO public.department_members (member_id, department_id, role_title)
    VALUES (v_member_id, v_dept, s.church_life->>'roleTitle')
    ON CONFLICT DO NOTHING;
  END LOOP;

  IF COALESCE(s.ai_completeness_score, s.completeness_score, 0) < 100 THEN
    INSERT INTO public.incomplete_profiles (member_id, completeness_score)
    VALUES (v_member_id, COALESCE(s.ai_completeness_score, s.completeness_score, 0))
    ON CONFLICT (member_id) DO UPDATE SET completeness_score = EXCLUDED.completeness_score;
  END IF;

  UPDATE public.member_registrations
    SET verification_status = 'approved',
        verified_by = v_uid,
        verified_at = now(),
        created_member_id = v_member_id
    WHERE id = s.id;

  member_id := v_member_id;
  member_code := v_code;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) TO authenticated;

-- Call sessions contain phone numbers, transcripts, costs, and recording paths.
-- Client callers may read only branch-authorized sessions; all writes go through
-- the authenticated Edge Functions/service role so clients cannot forge outcomes
-- or point a session at another recording.
DROP POLICY IF EXISTS "follow_up_call_sessions_staff_select" ON public.follow_up_call_sessions;
CREATE POLICY "follow_up_call_sessions_staff_select"
  ON public.follow_up_call_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR initiated_by = auth.uid()
    OR (
      (public.is_admin(auth.uid()) OR public.is_in_followup_department(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = follow_up_call_sessions.member_id
          AND m.branch_id = public.current_user_branch()
      )
    )
  );

DROP POLICY IF EXISTS "follow_up_call_sessions_staff_insert" ON public.follow_up_call_sessions;
DROP POLICY IF EXISTS "follow_up_call_sessions_staff_update" ON public.follow_up_call_sessions;
REVOKE INSERT, UPDATE ON public.follow_up_call_sessions FROM authenticated;
GRANT SELECT ON public.follow_up_call_sessions TO authenticated;
GRANT ALL ON public.follow_up_call_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.get_follow_up_call_sessions(p_member_id uuid)
RETURNS SETOF public.follow_up_call_sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT s.*
  FROM public.follow_up_call_sessions s
  JOIN public.members m ON m.id = s.member_id
  WHERE s.member_id = p_member_id
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR s.initiated_by = auth.uid()
      OR (
        (public.is_admin(auth.uid()) OR public.is_in_followup_department(auth.uid()))
        AND m.branch_id = public.current_user_branch()
      )
    )
  ORDER BY s.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_call_sessions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_call_sessions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_follow_up_call_transcript(
  p_call_id uuid,
  p_transcript text DEFAULT NULL,
  p_language text DEFAULT 'en',
  p_status text DEFAULT 'completed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_call public.follow_up_call_sessions%ROWTYPE;
  v_member_branch uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid transcription status';
  END IF;
  IF p_status = 'completed'
     AND (p_transcript IS NULL OR length(btrim(p_transcript)) = 0 OR length(p_transcript) > 100000) THEN
    RAISE EXCEPTION 'invalid transcript';
  END IF;
  IF p_language IS NOT NULL AND length(p_language) > 12 THEN
    RAISE EXCEPTION 'invalid transcript language';
  END IF;

  SELECT * INTO v_call
  FROM public.follow_up_call_sessions
  WHERE id = p_call_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'call not found';
  END IF;

  SELECT m.branch_id INTO v_member_branch
  FROM public.members m
  WHERE m.id = v_call.member_id;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR v_call.initiated_by = auth.uid()
    OR (
      (public.is_admin(auth.uid()) OR public.is_in_followup_department(auth.uid()))
      AND v_member_branch IS NOT NULL
      AND v_member_branch = public.current_user_branch()
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.follow_up_call_sessions
  SET transcript = CASE WHEN p_status = 'completed' THEN btrim(p_transcript) ELSE transcript END,
      transcript_language = CASE WHEN p_status = 'completed' THEN COALESCE(NULLIF(p_language, ''), 'en') ELSE transcript_language END,
      transcription_status = p_status,
      updated_at = now()
  WHERE id = p_call_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_follow_up_call_transcript(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_follow_up_call_transcript(uuid, text, text, text) TO authenticated;

-- Communication history and queueing are branch-scoped too. Clients may enqueue
-- through the guarded RPC, but cannot directly forge/update message rows.
DROP POLICY IF EXISTS "Follow-up staff can read messages" ON public.follow_up_messages;
CREATE POLICY "Follow-up staff can read messages"
  ON public.follow_up_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR created_by = auth.uid()
    OR (
      (public.is_admin(auth.uid()) OR public.is_in_followup_department(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = follow_up_messages.member_id
          AND m.branch_id = public.current_user_branch()
      )
    )
  );

DROP POLICY IF EXISTS "Follow-up staff can insert messages" ON public.follow_up_messages;
REVOKE INSERT ON public.follow_up_messages FROM authenticated;
GRANT SELECT ON public.follow_up_messages TO authenticated;
GRANT ALL ON public.follow_up_messages TO service_role;

CREATE OR REPLACE FUNCTION public.get_follow_up_communications(p_member_id uuid)
RETURNS TABLE (
  id uuid,
  channel text,
  message_type text,
  body text,
  status text,
  automated boolean,
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.is_admin(auth.uid())
    OR public.is_in_followup_department(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id AND m.branch_id = public.current_user_branch()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT m.id, m.channel, m.message_type, m.body, m.status, m.automated,
         m.scheduled_for, m.sent_at, m.provider_message_id, m.error_message,
         m.created_by, m.created_at
  FROM public.follow_up_messages m
  WHERE m.member_id = p_member_id
  ORDER BY m.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_follow_up_message(
  p_member_id uuid,
  p_channel text,
  p_body text,
  p_message_type text DEFAULT 'manual',
  p_scheduled_for timestamptz DEFAULT now(),
  p_automated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_message_id uuid;
  v_opted_out boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.is_admin(auth.uid())
    OR public.is_in_followup_department(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id AND m.branch_id = public.current_user_branch()
      AND m.membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Member not found or outside your branch';
  END IF;

  IF p_automated AND NOT (
    public.has_role(auth.uid(), 'super_admin') OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only admins may queue automated messages';
  END IF;
  IF p_channel NOT IN ('whatsapp', 'sms') THEN
    RAISE EXCEPTION 'Unsupported communication channel';
  END IF;
  IF p_message_type NOT IN ('manual', 'welcome', 'reminder', 'follow_up', 'stage_update') THEN
    RAISE EXCEPTION 'Unsupported message type';
  END IF;
  IF length(btrim(COALESCE(p_body, ''))) = 0 OR length(p_body) > 2000 THEN
    RAISE EXCEPTION 'Message must contain 1 to 2000 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = p_member_id AND membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Member not found or inactive';
  END IF;

  SELECT COALESCE(notification_opt_out, false)
  INTO v_opted_out
  FROM public.members WHERE id = p_member_id;
  IF v_opted_out THEN
    RAISE EXCEPTION 'This member has opted out of notifications';
  END IF;

  INSERT INTO public.follow_up_messages (
    member_id, channel, message_type, body, automated, scheduled_for, created_by
  ) VALUES (
    p_member_id, p_channel, p_message_type, btrim(p_body), p_automated,
    COALESCE(p_scheduled_for, now()), auth.uid()
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_follow_up_communications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_communications(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.queue_follow_up_message(uuid, text, text, text, timestamptz, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_follow_up_message(uuid, text, text, text, timestamptz, boolean) TO authenticated;

COMMIT;
