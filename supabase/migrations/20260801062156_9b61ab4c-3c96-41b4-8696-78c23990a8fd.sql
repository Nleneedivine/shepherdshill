ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.registration_attempts TO service_role;
REVOKE ALL ON public.registration_attempts FROM anon, authenticated;
CREATE POLICY "Admins can view registration attempts"
  ON public.registration_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS notification_opt_out boolean NOT NULL DEFAULT false;