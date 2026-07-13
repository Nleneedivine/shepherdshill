
-- 1) Prevent privilege escalation via profiles UPDATE
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'forbidden: cannot modify is_super_admin';
    END IF;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'forbidden: cannot change profile id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Also add explicit WITH CHECK on the update policy
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2) system_logs: replace WITH CHECK (true) with owner-scoped check
DROP POLICY IF EXISTS "Authenticated insert logs" ON public.system_logs;
CREATE POLICY "Authenticated insert own logs" ON public.system_logs
FOR INSERT TO authenticated
WITH CHECK (performed_by = auth.uid() OR performed_by IS NULL);

-- 3) member_registrations: tighten submission policy
DROP POLICY IF EXISTS "Anyone can submit a registration" ON public.member_registrations;
CREATE POLICY "Anyone can submit a registration" ON public.member_registrations
FOR INSERT TO anon, authenticated
WITH CHECK (
  verification_status = 'pending'
  AND created_member_id IS NULL
  AND verified_by IS NULL
  AND verified_at IS NULL
);

-- 4) Remove anon role from storage member-photos upload policy (visitors are signed in anonymously)
DROP POLICY IF EXISTS "member-photos anon upload onboarding" ON storage.objects;
CREATE POLICY "member-photos onboarding upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'member-photos'
  AND (storage.foldername(name))[1] = 'onboarding'
);

-- 5) Lock down SECURITY DEFINER functions
-- Revoke default PUBLIC execute, then grant to appropriate roles
REVOKE ALL ON FUNCTION public.grant_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_member_submission(uuid, jsonb, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
