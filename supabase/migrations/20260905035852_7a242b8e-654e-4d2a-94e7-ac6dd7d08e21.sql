DROP POLICY IF EXISTS "Published sermons are publicly readable" ON public.sermons;

CREATE POLICY "Anyone can read published sermons"
ON public.sermons FOR SELECT
USING (is_published = true);

CREATE POLICY "Sermon managers can read all sermons"
ON public.sermons FOR SELECT TO authenticated
USING (public.can_manage_sermons(auth.uid()));