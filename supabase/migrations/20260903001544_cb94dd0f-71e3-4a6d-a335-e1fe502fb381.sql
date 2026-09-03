CREATE TABLE public.sermons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  preacher text NOT NULL,
  service_type text NOT NULL DEFAULT 'Sunday Service',
  sermon_date date NOT NULL DEFAULT CURRENT_DATE,
  youtube_url text NOT NULL,
  youtube_video_id text,
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sermons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sermons TO authenticated;
GRANT ALL ON public.sermons TO service_role;

ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_sermons(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_or_higher(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('it_team','media_team')
      );
$$;

REVOKE ALL ON FUNCTION public.can_manage_sermons(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_sermons(uuid) TO authenticated, service_role;

CREATE POLICY "Published sermons are publicly readable"
ON public.sermons FOR SELECT
USING (is_published = true OR public.can_manage_sermons(auth.uid()));

CREATE POLICY "Sermon managers can insert"
ON public.sermons FOR INSERT TO authenticated
WITH CHECK (public.can_manage_sermons(auth.uid()));

CREATE POLICY "Sermon managers can update"
ON public.sermons FOR UPDATE TO authenticated
USING (public.can_manage_sermons(auth.uid()))
WITH CHECK (public.can_manage_sermons(auth.uid()));

CREATE POLICY "Sermon managers can delete"
ON public.sermons FOR DELETE TO authenticated
USING (public.can_manage_sermons(auth.uid()));

CREATE TRIGGER sermons_set_updated_at
BEFORE UPDATE ON public.sermons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();