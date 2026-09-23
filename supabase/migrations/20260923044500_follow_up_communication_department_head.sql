-- Allow the Follow-Up department head to manage its own communication controls.
drop policy if exists "follow_up_comm_settings_admin_update" on public.follow_up_communication_settings;
create policy "follow_up_comm_settings_admin_update"
on public.follow_up_communication_settings for update to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or public.has_role((select auth.uid()), 'super_admin')
  or (
    public.has_role((select auth.uid()), 'department_head')
    and public.is_in_followup_department((select auth.uid()))
  )
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or public.has_role((select auth.uid()), 'super_admin')
  or (
    public.has_role((select auth.uid()), 'department_head')
    and public.is_in_followup_department((select auth.uid()))
  )
);
