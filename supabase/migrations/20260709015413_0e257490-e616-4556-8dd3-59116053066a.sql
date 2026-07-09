
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;

-- Replace permissive insert policy with an explicit non-trivial check
DROP POLICY IF EXISTS "Anyone can submit registration" ON public.member_registrations;
CREATE POLICY "Anyone can submit registration" ON public.member_registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND personal ? 'firstName'
    AND personal ? 'lastName'
  );
