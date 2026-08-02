-- 1. Restrict overly permissive reads to staff roles (and exclude anonymous sessions)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','senior_pastor','pastoral_team','parish_pastor','area_supervisor','zonal_pastor','provincial_pastor','cell_leader','worker','department_head')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS authenticated_read_branch_settings ON public.branch_settings;
CREATE POLICY staff_read_branch_settings ON public.branch_settings
  FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS authenticated_read_schemes ON public.family_grouping_schemes;
CREATE POLICY staff_read_schemes ON public.family_grouping_schemes
  FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS authenticated_read_family_groups ON public.family_groups;
CREATE POLICY staff_read_family_groups ON public.family_groups
  FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.is_staff(auth.uid())
  );

-- 2. Exclude anonymous sessions from storage policies
DROP POLICY IF EXISTS "member-photos admin manage" ON storage.objects;
CREATE POLICY "member-photos admin manage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    bucket_id = 'member-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

DROP POLICY IF EXISTS "member-photos pastoral read" ON storage.objects;
CREATE POLICY "member-photos pastoral read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'pastoral_team')
      OR public.has_role(auth.uid(), 'senior_pastor')
    )
  );

-- 3. Fix mutable search_path + lock down SECURITY DEFINER execution
ALTER FUNCTION public.assign_member_family_group(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.reassign_all_members_to_scheme(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.switch_family_grouping_scheme(uuid, uuid) SET search_path = public;

REVOKE ALL ON FUNCTION public.assign_member_family_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reassign_all_members_to_scheme(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.switch_family_grouping_scheme(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_member_family_group(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.switch_family_grouping_scheme(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reassign_all_members_to_scheme(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, app_role, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 4. In-function authorization checks for admin-only family grouping routines
CREATE OR REPLACE FUNCTION public.assign_member_family_group(p_member_id uuid, p_scheme_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
  v_scheme_id uuid;
  v_age integer;
  v_group_id uuid;
  v_branch_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL AND NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    m.*,
    EXTRACT(YEAR FROM AGE(NOW(), (m.personal->>'dateOfBirth')::date))::integer AS age_years
  INTO v_member
  FROM members m
  WHERE m.id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  v_age := v_member.age_years;
  v_branch_id := v_member.branch_id;

  IF p_scheme_id IS NULL THEN
    SELECT active_family_scheme_id INTO v_scheme_id
    FROM branch_settings
    WHERE branch_id = v_branch_id;
  ELSE
    v_scheme_id := p_scheme_id;
  END IF;

  IF v_scheme_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT fg.id INTO v_group_id
  FROM family_groups fg
  JOIN branch_settings bs ON bs.branch_id = v_branch_id
  WHERE fg.scheme_id = v_scheme_id
    AND fg.is_active = true
    AND (fg.min_age IS NULL OR v_age >= fg.min_age)
    AND (fg.max_age IS NULL OR v_age <= fg.max_age)
    AND (fg.name NOT ILIKE '%elder%' OR v_age >= bs.elders_age_threshold)
    AND (
      fg.gender_restriction = 'all'
      OR fg.gender_restriction = LOWER(COALESCE(v_member.personal->>'gender', 'all'))
    )
    AND (
      fg.marital_status_rule = 'any'
      OR (fg.marital_status_rule = 'married' AND LOWER(COALESCE(v_member.personal->>'maritalStatus', '')) = 'married')
      OR (fg.marital_status_rule = 'unmarried' AND LOWER(COALESCE(v_member.personal->>'maritalStatus', '')) <> 'married')
    )
  ORDER BY fg.assignment_priority ASC, fg.sequence_order ASC
  LIMIT 1;

  IF v_group_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO member_family_groups (member_id, group_id, scheme_id, assigned_at, assigned_by)
  VALUES (p_member_id, v_group_id, v_scheme_id, now(), 'system')
  ON CONFLICT (member_id, scheme_id)
  DO UPDATE SET group_id = v_group_id, assigned_at = now(), assigned_by = 'system', is_active = true;

  RETURN v_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.switch_family_grouping_scheme(p_scheme_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_scheme_name text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT name INTO v_scheme_name
  FROM family_grouping_schemes
  WHERE id = p_scheme_id AND branch_id = p_branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scheme not found for this branch';
  END IF;

  UPDATE branch_settings
  SET active_family_scheme_id = p_scheme_id, updated_at = now()
  WHERE branch_id = p_branch_id;

  UPDATE family_grouping_schemes SET is_active = false WHERE branch_id = p_branch_id AND id <> p_scheme_id;
  UPDATE family_grouping_schemes SET is_active = true WHERE id = p_scheme_id;

  v_count := reassign_all_members_to_scheme(p_scheme_id, p_branch_id);

  RETURN jsonb_build_object('success', true, 'scheme_name', v_scheme_name, 'members_reassigned', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_member_family_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.switch_family_grouping_scheme(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_member_family_group(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.switch_family_grouping_scheme(uuid, uuid) TO authenticated, service_role;