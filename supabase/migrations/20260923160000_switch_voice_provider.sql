-- Switch Shepherd's Hill away from Africa's Talking.
-- Calling stays OFF until the new carrier adapter is configured and tested.
update public.follow_up_communication_settings
set provider = 'notify_africa',
    calling_enabled = false,
    updated_at = now()
where id = true;
