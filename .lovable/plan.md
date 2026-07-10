# Implementation plan — 3 sprints in one pass

Rebrand sprint (Shepherd's Hill + logo + SHI prefix) is **deferred** until you re-upload the logo. Everything else ships now.

## Schema reality check

Your DB doesn't match the spec verbatim. I'll adapt as follows (no destructive changes):

| Spec says | Actually in DB | Approach |
|---|---|---|
| `roles` table with `is_system_role` | `app_role` enum only | Use the enum. No new `roles` table. |
| `member_roles` (member_id, role_id, branch_id, assigned_by, assigned_at) | `user_roles` (user_id, role, created_at) | Add `assigned_by`, `assigned_at`, `branch_id` columns to `user_roles`. Keep enum-based `role`. |
| `membership_stages` table | `members.membership_stage` text | Distinct query on that column for filter options. |
| `zones` | none | Drop zone filter (keep cell group filter). |
| `join_date` | `members.created_at` | Use `created_at`. |
| `member_biometrics.has_face` | only `has_qr` exists | Add `has_face`, `has_fingerprint` boolean columns. |

## Sprint A — Super admin grant + user management

**Migration:**
- Add `is_super_admin boolean default false` to `profiles` (verify — may already exist).
- Add `assigned_by uuid`, `assigned_at timestamptz default now()`, `branch_id uuid references branches(id)` to `user_roles`.
- Update `handle_new_user` to keep working.
- SECURITY DEFINER function `grant_super_admin_by_email(text)` — findable by super_admin only.
- SECURITY DEFINER function `assign_user_role(target_user_id, new_role app_role, branch_id)` — enforces: super_admin can grant anything; admin can grant admin/worker/member only; nobody can self-demote; logs to `system_logs`.
- Seed call: `SELECT grant_super_admin_by_email('nleneeletura@gmail.com'); SELECT grant_super_admin_by_email('info.nextgenrobot@gmail.com');`

**Files:**
- `src/routes/_authenticated/super-admin.users.tsx` — replace placeholder with full page (search, role filter, status filter, paginated table, avatar + name, email, phone, current roles, actions).
- `src/features/super-admin/RoleModal.tsx` — radio (Member / Admin / Super Admin / Custom), warning box + confirmation checkbox for super_admin, calls `assign_user_role` RPC. Admins see no Super Admin option.
- `src/features/super-admin/useUsers.ts` — data hook (joins profiles + user_roles; email/phone pulled from profiles since we can't read auth.users directly on client).

Note: `auth.users` isn't queryable from the client. Email/phone come from `profiles` (already populated by `handle_new_user` trigger). Anyone signed up will appear.

## Sprint B — Realtime + notification stubs

**Migration:**
- `ALTER PUBLICATION supabase_realtime ADD TABLE member_registrations, members, system_logs;`
- Set `REPLICA IDENTITY FULL` on those tables so UPDATE payloads include full row.
- Add `preferred_notification_channel text default 'auto'`, `notification_opt_out boolean default false` to `profiles`.

**Files:**
- `src/routes/_authenticated/admin.verifications.tsx` — replace realtime subscription per spec (INSERT prepends + toast, UPDATE replaces in place), add pulsing Live/Reconnecting dot in header.
- `src/lib/notifications.ts` — client-safe types (`NotificationPayload`, `NotificationChannel`) + `sendNotification()` that calls the edge function. **No direct provider API calls from client** — that's the rule.
- `supabase/functions/send-welcome-notification/index.ts` — replace stub with: fetch member, compose Shepherd's Hill welcome message, try WhatsApp → SMS chain, log to `system_logs`. Provider calls guarded by `if (env)` — no-ops cleanly until you add WHATSAPP_API_TOKEN / AT_API_KEY secrets. Structured for drop-in when keys land.

## Sprint C — Members list at /members

**Migration:**
- Add `has_face boolean default false`, `has_fingerprint boolean default false` to `member_biometrics`.
- RLS: `SELECT` policy on `members` for `admin`, `senior_pastor`, `pastoral_team`, `super_admin` (scoped to their branch; super_admin sees all). Grants for `authenticated`.
- Same-shape RLS on `cell_groups`, `departments`, `department_members` for these roles (read).

**Files:**
- `src/routes/_authenticated/members.tsx` — replace current placeholder.
- `src/features/members/MembersPage.tsx` — page shell + stats row (4 StatCards) + filter bar + view toggle + table/grid + bulk action bar + empty state.
- `src/features/members/MembersTable.tsx`, `MembersGrid.tsx`, `MemberFilters.tsx`, `useMembers.ts` (URL-param synced filters, debounced search, sortable columns).
- Sort: name, created_at, membership_stage. Pagination: 20/page.
- Bulk action bar: shown when selection > 0, buttons wired as UI-only for actions that need Sprint 1B (Send Message, Assign, Change Stage) — Deactivate + Export CSV are functional.
- URL params: `q`, `stage`, `dept`, `cell`, `status`, `bio`, `view`, `page`, `sort`.

Add Member button links to `/register` (placeholder for Sprint 1B admin-side add).

## Explicitly NOT in this pass

- Rebrand to Shepherd's Hill / logo / SHI member-code prefix — waiting on logo upload.
- Real WhatsApp/Africa's Talking sending — edge function is wired end-to-end but returns `{ skipped: true }` per channel until secrets are added.
- Add Member admin form — Sprint 1B per your note.
- Notification prefs UI in member portal — marked TODO in code.

## Sequence

Two migrations first (needs your approval before I can query the new columns), then all component files in parallel. Roughly 15-18 files touched.

Approve and I'll start with the Sprint A migration.