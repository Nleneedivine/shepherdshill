alter table public.follow_up_communication_settings
  add column if not exists messaging_agent_id text;

comment on column public.follow_up_communication_settings.messaging_agent_id
  is 'Provider-side agent identifier used for SMS/WhatsApp messaging APIs.';

update public.follow_up_communication_settings
set provider = case
  when provider = 'africastalking' then 'voicebip'
  else provider
end,
updated_at = now()
where id = true;

