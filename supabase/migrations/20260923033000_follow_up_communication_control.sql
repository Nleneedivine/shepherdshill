create table if not exists public.follow_up_communication_settings (
  id boolean primary key default true check (id = true),
  provider text not null default 'africastalking',
  messaging_enabled boolean not null default false,
  calling_enabled boolean not null default false,
  voice_number text,
  sender_id text,
  currency text not null default 'NGN',
  voice_rate_per_minute numeric(12,4),
  low_balance_threshold numeric(12,2) not null default 5000,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.follow_up_communication_settings (id) values (true) on conflict (id) do nothing;

alter table public.follow_up_communication_settings enable row level security;

drop policy if exists "follow_up_comm_settings_staff_select" on public.follow_up_communication_settings;
create policy "follow_up_comm_settings_staff_select"
on public.follow_up_communication_settings for select to authenticated
using (has_role((select auth.uid()), 'admin') or is_in_followup_department((select auth.uid())));

drop policy if exists "follow_up_comm_settings_admin_update" on public.follow_up_communication_settings;
create policy "follow_up_comm_settings_admin_update"
on public.follow_up_communication_settings for update to authenticated
using (has_role((select auth.uid()), 'admin'))
with check (has_role((select auth.uid()), 'admin'));

grant select, update on public.follow_up_communication_settings to authenticated;