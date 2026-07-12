
-- FIELD MEMORY
CREATE TABLE public.field_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_memory TO authenticated;
GRANT ALL ON public.field_memory TO service_role;
ALTER TABLE public.field_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own field memory"
  ON public.field_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX field_memory_user_key_idx ON public.field_memory(user_id, field_key);

-- FORM DRAFTS
CREATE TABLE public.form_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  form_key TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INTEGER NOT NULL DEFAULT 0,
  completeness_score INTEGER NOT NULL DEFAULT 0,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT form_drafts_owner_check CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE UNIQUE INDEX form_drafts_user_key_idx ON public.form_drafts(user_id, form_key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX form_drafts_session_key_idx ON public.form_drafts(session_id, form_key) WHERE session_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_drafts TO anon;
GRANT ALL ON public.form_drafts TO service_role;

ALTER TABLE public.form_drafts ENABLE ROW LEVEL SECURITY;

-- Authenticated: own row
CREATE POLICY "Users manage their own form drafts"
  ON public.form_drafts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins and super admins can view all drafts (for follow-up on abandoned registrations)
CREATE POLICY "Admins view all form drafts"
  ON public.form_drafts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete abandoned drafts"
  ON public.form_drafts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Anonymous session-based drafts. Anon can insert/update/delete rows keyed by a session id they know.
CREATE POLICY "Anon inserts own session draft"
  ON public.form_drafts FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "Anon updates own session draft"
  ON public.form_drafts FOR UPDATE TO anon
  USING (user_id IS NULL AND session_id IS NOT NULL)
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "Anon selects own session draft"
  ON public.form_drafts FOR SELECT TO anon
  USING (user_id IS NULL AND session_id IS NOT NULL);

CREATE POLICY "Anon deletes own session draft"
  ON public.form_drafts FOR DELETE TO anon
  USING (user_id IS NULL AND session_id IS NOT NULL);
