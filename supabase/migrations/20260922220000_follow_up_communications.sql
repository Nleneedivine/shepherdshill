-- Follow-Up Hub: provider-neutral communication queue and history.
-- This creates the messaging foundation for WhatsApp/SMS automation.
-- Actual delivery is intentionally provider-neutral until a messaging provider is connected.

CREATE TABLE IF NOT EXISTS public.follow_up_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  message_type text NOT NULL DEFAULT 'manual'
    CHECK (message_type IN ('manual', 'welcome', 'reminder', 'follow_up', 'stage_update')),
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
  automated boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_messages_member_created
  ON public.follow_up_messages(member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_messages_queue
  ON public.follow_up_messages(status, scheduled_for);

ALTER TABLE public.follow_up_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follow-up staff can read messages"
  ON public.follow_up_messages;

CREATE POLICY "Follow-up staff can read messages"
ON public.follow_up_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.is_in_followup_department(auth.uid())
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Follow-up staff can insert messages"
  ON public.follow_up_messages;

CREATE POLICY "Follow-up staff can insert messages"
ON public.follow_up_messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_in_followup_department(auth.uid())
  )
  AND created_by = auth.uid()
);

GRANT SELECT, INSERT
ON public.follow_up_messages
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_follow_up_communications(
  p_member_id uuid
)
RETURNS TABLE (
  id uuid,
  channel text,
  message_type text,
  body text,
  status text,
  automated boolean,
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_in_followup_department(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.channel,
    m.message_type,
    m.body,
    m.status,
    m.automated,
    m.scheduled_for,
    m.sent_at,
    m.provider_message_id,
    m.error_message,
    m.created_by,
    m.created_at
  FROM public.follow_up_messages m
  WHERE m.member_id = p_member_id
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_follow_up_message(
  p_member_id uuid,
  p_channel text,
  p_body text,
  p_message_type text DEFAULT 'manual',
  p_scheduled_for timestamptz DEFAULT now(),
  p_automated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
  v_opted_out boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_in_followup_department(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_channel NOT IN ('whatsapp', 'sms') THEN
    RAISE EXCEPTION 'Unsupported communication channel';
  END IF;

  IF p_message_type NOT IN ('manual', 'welcome', 'reminder', 'follow_up', 'stage_update') THEN
    RAISE EXCEPTION 'Unsupported message type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = p_member_id
      AND membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Member not found or inactive';
  END IF;

  SELECT COALESCE(notification_opt_out, false)
  INTO v_opted_out
  FROM public.members
  WHERE id = p_member_id;

  IF v_opted_out THEN
    RAISE EXCEPTION 'This member has opted out of notifications';
  END IF;

  IF trim(COALESCE(p_body, '')) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  INSERT INTO public.follow_up_messages (
    member_id,
    channel,
    message_type,
    body,
    automated,
    scheduled_for,
    created_by
  )
  VALUES (
    p_member_id,
    p_channel,
    p_message_type,
    trim(p_body),
    p_automated,
    COALESCE(p_scheduled_for, now()),
    auth.uid()
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_follow_up_communications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_up_communications(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.queue_follow_up_message(uuid, text, text, text, timestamptz, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_follow_up_message(uuid, text, text, text, timestamptz, boolean)
TO authenticated;
