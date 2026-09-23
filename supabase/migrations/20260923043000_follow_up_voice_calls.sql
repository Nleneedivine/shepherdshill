-- Reusable Africa's Talking voice call + recording foundation.
create table if not exists public.follow_up_call_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null,
  operator_phone text not null,
  member_phone text not null,
  provider text not null default 'africastalking',
  provider_session_id text,
  client_request_id text unique,
  status text not null default 'queued'
    check (status in ('queued','dialing','ringing','bridged','completed','not_answered','failed','expired')),
  duration_seconds integer,
  cost numeric(12,4),
  recording_url text,
  recording_path text,
  recording_status text not null default 'pending'
    check (recording_status in ('pending','available','failed')),
  transcription_status text not null default 'not_started'
    check (transcription_status in ('not_started','processing','completed','failed')),
  transcript text,
  transcript_language text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_up_call_sessions_member_created
  on public.follow_up_call_sessions(member_id, created_at desc);
create index if not exists idx_follow_up_call_sessions_provider
  on public.follow_up_call_sessions(provider_session_id);
create index if not exists idx_follow_up_call_sessions_status
  on public.follow_up_call_sessions(status, created_at desc);

alter table public.follow_up_call_sessions enable row level security;

drop policy if exists "follow_up_call_sessions_staff_select" on public.follow_up_call_sessions;
create policy "follow_up_call_sessions_staff_select"
on public.follow_up_call_sessions for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
  or public.is_in_followup_department(auth.uid())
  or initiated_by = auth.uid()
);

drop policy if exists "follow_up_call_sessions_staff_insert" on public.follow_up_call_sessions;
create policy "follow_up_call_sessions_staff_insert"
on public.follow_up_call_sessions for insert to authenticated
with check (
  (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.is_in_followup_department(auth.uid())
  )
  and initiated_by = auth.uid()
);

drop policy if exists "follow_up_call_sessions_staff_update" on public.follow_up_call_sessions;
create policy "follow_up_call_sessions_staff_update"
on public.follow_up_call_sessions for update to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
  or public.is_in_followup_department(auth.uid())
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'super_admin')
  or public.is_in_followup_department(auth.uid())
);

grant select, insert, update on public.follow_up_call_sessions to authenticated;

-- Private storage; recordings are exposed through a signed-URL edge function.
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

create or replace function public.get_follow_up_call_sessions(p_member_id uuid)
returns setof public.follow_up_call_sessions
language sql
security definer
set search_path = public
as $$
  select *
  from public.follow_up_call_sessions
  where member_id = p_member_id
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'super_admin')
      or public.is_in_followup_department(auth.uid())
      or initiated_by = auth.uid()
    )
  order by created_at desc;
$$;

revoke all on function public.get_follow_up_call_sessions(uuid) from public, anon;
grant execute on function public.get_follow_up_call_sessions(uuid) to authenticated;
