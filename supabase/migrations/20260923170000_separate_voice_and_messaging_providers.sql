alter table public.follow_up_communication_settings
  add column if not exists voice_provider text not null default 'notify_africa',
  add column if not exists messaging_provider text not null default 'voicebip';

update public.follow_up_communication_settings
set voice_provider = 'notify_africa',
    messaging_provider = 'voicebip',
    calling_enabled = false,
    updated_at = now()
where id = true;
