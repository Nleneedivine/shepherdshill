-- Persist provider rejection details so calls do not fail silently.
alter table public.follow_up_call_sessions
  add column if not exists error_message text;

comment on column public.follow_up_call_sessions.error_message is
  'Sanitized provider or initiation error shown to authorized Follow-Up staff for troubleshooting.';
