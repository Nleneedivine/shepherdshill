-- 1. Only create profile + default role for REAL sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Privilege guard allows the derived cache sync
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF NEW.is_super_admin IS DISTINCT FROM EXISTS (
         SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = NEW.id AND ur.role = 'super_admin'
       )
       AND NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'forbidden: cannot modify is_super_admin';
    END IF;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'forbidden: cannot change profile id';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. profiles.is_super_admin becomes a derived cache of user_roles
CREATE OR REPLACE FUNCTION public.sync_is_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles p
     SET is_super_admin = EXISTS (
           SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = v_user AND ur.role = 'super_admin'
         ),
         updated_at = now()
   WHERE p.id = v_user;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_sync_super_admin ON public.user_roles;
CREATE TRIGGER trg_user_roles_sync_super_admin
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_is_super_admin();

UPDATE public.profiles p
   SET is_super_admin = EXISTS (
     SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin'
   )
 WHERE p.is_super_admin IS DISTINCT FROM EXISTS (
     SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin'
   );

-- 4. role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read role permissions" ON public.role_permissions;
CREATE POLICY "Staff can read role permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Super admins manage role permissions"
ON public.role_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_role_permissions_updated ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT r.role, p.key,
  CASE
    WHEN r.role = 'super_admin' THEN true
    WHEN r.role = 'admin' AND p.key <> 'settings.manage_roles' THEN true
    WHEN r.role IN ('senior_pastor','pastoral_team') AND p.key IN ('members.view','members.edit','registrations.view','registrations.approve','reports.view') THEN true
    WHEN r.role = 'worker' AND p.key IN ('members.view','registrations.view') THEN true
    ELSE false
  END
FROM (SELECT unnest(ARRAY['super_admin','admin','senior_pastor','pastoral_team','worker','member','first_timer']::public.app_role[]) AS role) r
CROSS JOIN (SELECT unnest(ARRAY[
  'members.view','members.create','members.edit','members.delete',
  'registrations.view','registrations.approve',
  'reports.view','settings.manage','settings.manage_roles','users.manage'
]) AS key) p
ON CONFLICT (role, permission_key) DO NOTHING;

-- 5. Link profile -> member on approval
CREATE OR REPLACE FUNCTION public.link_profile_to_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.registration_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.member_registrations WHERE id = NEW.registration_id;
  IF v_user IS NOT NULL THEN
    UPDATE public.profiles SET member_id = NEW.id, updated_at = now()
     WHERE id = v_user AND member_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_link_profile ON public.members;
CREATE TRIGGER trg_members_link_profile
AFTER INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_member();

-- 6. Admin listing that distinguishes anonymous sessions
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT '',
  p_anonymous boolean DEFAULT false,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  is_super_admin boolean,
  branch_id uuid,
  branch_name text,
  is_anonymous boolean,
  created_at timestamptz,
  roles text[],
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT u.id AS uid,
           COALESCE(p.full_name, u.raw_user_meta_data->>'full_name') AS f_name,
           COALESCE(p.email, u.email) AS f_email,
           COALESCE(p.phone, u.phone) AS f_phone,
           COALESCE(p.is_super_admin, false) AS f_super,
           p.branch_id AS f_branch,
           b.name AS f_branch_name,
           COALESCE(u.is_anonymous, false) AS f_anon,
           u.created_at AS f_created,
           COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id), '{}') AS f_roles
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.branches b ON b.id = p.branch_id
    WHERE COALESCE(u.is_anonymous, false) = COALESCE(p_anonymous, false)
  ), filtered AS (
    SELECT * FROM base
    WHERE COALESCE(p_search, '') = ''
       OR f_name ILIKE '%' || p_search || '%'
       OR f_email ILIKE '%' || p_search || '%'
       OR f_phone ILIKE '%' || p_search || '%'
  )
  SELECT f.uid, f.f_name, f.f_email, f.f_phone, f.f_super, f.f_branch, f.f_branch_name,
         f.f_anon, f.f_created, f.f_roles,
         (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.f_created DESC
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, boolean, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, boolean, int, int) TO authenticated;