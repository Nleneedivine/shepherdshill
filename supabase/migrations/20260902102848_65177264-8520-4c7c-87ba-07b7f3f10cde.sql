CREATE POLICY "site_media_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.has_role_or_higher(auth.uid(), 'admin'));

CREATE POLICY "site_media_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.has_role_or_higher(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'site-media' AND public.has_role_or_higher(auth.uid(), 'admin'));

CREATE POLICY "site_media_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.has_role_or_higher(auth.uid(), 'admin'));

CREATE POLICY "site_media_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'site-media' AND public.has_role_or_higher(auth.uid(), 'admin'));