-- 1. Role ranking + hierarchy helpers
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'super_admin' THEN 100
    WHEN 'admin' THEN 90
    WHEN 'senior_pastor' THEN 80
    WHEN 'provincial_pastor' THEN 75
    WHEN 'zonal_pastor' THEN 72
    WHEN 'area_supervisor' THEN 70
    WHEN 'parish_pastor' THEN 68
    WHEN 'pastoral_team' THEN 65
    WHEN 'counselling_pastor' THEN 62
    WHEN 'finance_director' THEN 60
    WHEN 'department_head' THEN 55
    WHEN 'cell_leader' THEN 50
    WHEN 'prayer_coordinator' THEN 45
    WHEN 'finance_team' THEN 40
    WHEN 'media_team' THEN 40
    WHEN 'communications_team' THEN 40
    WHEN 'facilities_team' THEN 40
    WHEN 'it_team' THEN 40
    WHEN 'protocol_team' THEN 40
    WHEN 'usher' THEN 35
    WHEN 'worker' THEN 30
    WHEN 'volunteer' THEN 25
    WHEN 'member' THEN 10
    WHEN 'first_timer' THEN 5
    WHEN 'visitor' THEN 1
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.role_rank(app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.role_rank(app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND public.role_rank(ur.role) >= public.role_rank(_role)
  );
$$;

REVOKE ALL ON FUNCTION public.has_role_or_higher(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_or_higher(uuid, app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_or_higher(_user_id, 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_pastoral(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_or_higher(_user_id, 'pastoral_team');
$$;

REVOKE ALL ON FUNCTION public.is_pastoral(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pastoral(uuid) TO authenticated, service_role;

-- Convenience: caller's effective roles without hitting RLS
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = auth.uid()), '{}');
$$;

REVOKE ALL ON FUNCTION public.my_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated, service_role;

-- 2. Drop duplicate policies
DROP POLICY IF EXISTS "Allow anonymous branch lookup" ON public.branches;
DROP POLICY IF EXISTS "users_own_field_memory" ON public.field_memory;
DROP POLICY IF EXISTS "Users can update their own pending registration" ON public.member_registrations;
DROP POLICY IF EXISTS "Users can view their own pending registration" ON public.member_registrations;

-- 3. Rewrite admin-scoped policies to use the hierarchy
DROP POLICY IF EXISTS "Admins can update registrations" ON public.member_registrations;
CREATE POLICY "Admins can update registrations" ON public.member_registrations
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete registrations" ON public.member_registrations;
CREATE POLICY "Admins can delete registrations" ON public.member_registrations
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view registrations" ON public.member_registrations;
CREATE POLICY "Admins can view registrations" ON public.member_registrations
  FOR SELECT TO authenticated USING (public.is_pastoral(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
CREATE POLICY "Admins can manage members" ON public.members
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Members read own or admins read all" ON public.members;
CREATE POLICY "Members read own or admins read all" ON public.members
  FOR SELECT TO authenticated USING (
    public.is_pastoral(auth.uid())
    OR auth.uid() = (SELECT p.id FROM public.profiles p WHERE p.member_id = members.id LIMIT 1)
  );

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view all form drafts" ON public.form_drafts;
CREATE POLICY "Admins view all form drafts" ON public.form_drafts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete abandoned drafts" ON public.form_drafts;
CREATE POLICY "Admins delete abandoned drafts" ON public.form_drafts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage department members" ON public.department_members;
CREATE POLICY "Admins manage department members" ON public.department_members
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pastoral read department members" ON public.department_members;
CREATE POLICY "Pastoral read department members" ON public.department_members
  FOR SELECT TO authenticated USING (public.is_pastoral(auth.uid()));

DROP POLICY IF EXISTS "Admins manage biometrics" ON public.member_biometrics;
CREATE POLICY "Admins manage biometrics" ON public.member_biometrics
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pastoral read biometrics" ON public.member_biometrics;
CREATE POLICY "Pastoral read biometrics" ON public.member_biometrics
  FOR SELECT TO authenticated USING (public.is_pastoral(auth.uid()));

DROP POLICY IF EXISTS "Admins manage spiritual journey" ON public.spiritual_journey;
CREATE POLICY "Admins manage spiritual journey" ON public.spiritual_journey
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage incomplete profiles" ON public.incomplete_profiles;
CREATE POLICY "Admins manage incomplete profiles" ON public.incomplete_profiles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view registration attempts" ON public.registration_attempts;
CREATE POLICY "Admins can view registration attempts" ON public.registration_attempts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins view logs" ON public.system_logs;
CREATE POLICY "Super admins view logs" ON public.system_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_manage_schemes" ON public.family_grouping_schemes;
CREATE POLICY "admins_manage_schemes" ON public.family_grouping_schemes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_manage_family_groups" ON public.family_groups;
CREATE POLICY "admins_manage_family_groups" ON public.family_groups
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_manage_member_groups" ON public.member_family_groups;
CREATE POLICY "admins_manage_member_groups" ON public.member_family_groups
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_manage_branch_settings" ON public.branch_settings;
CREATE POLICY "admins_manage_branch_settings" ON public.branch_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Super admins manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Make existing security-definer helpers hierarchy-aware
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_or_higher(_user_id, 'worker');
$$;