-- Move live human-to-human calling from Notify Africa to Infobip Click-to-Call.
-- Calling remains OFF until an Infobip account, Nigerian-capable voice number,
-- API key and callback URL have been configured and a real two-party test passes.
update public.follow_up_communication_settings
set
  provider = 'infobip',
  voice_provider = 'infobip',
  calling_enabled = false,
  updated_at = now()
where id = true;
