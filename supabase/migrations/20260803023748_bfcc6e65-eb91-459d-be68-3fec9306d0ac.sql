GRANT ALL ON public.member_registrations TO service_role;
GRANT ALL ON public.registration_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.member_registrations TO authenticated;
GRANT SELECT ON public.registration_attempts TO authenticated;