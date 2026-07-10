
DROP POLICY IF EXISTS "member-photos anon upload onboarding" ON storage.objects;
CREATE POLICY "member-photos anon upload onboarding"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = 'onboarding');

DROP POLICY IF EXISTS "member-photos read authenticated" ON storage.objects;
CREATE POLICY "member-photos read authenticated"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'member-photos');

DROP POLICY IF EXISTS "member-photos admin manage" ON storage.objects;
CREATE POLICY "member-photos admin manage"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'member-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (bucket_id = 'member-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
