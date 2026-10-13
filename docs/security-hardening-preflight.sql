-- READ-ONLY preflight for Shepherds Hill security-hardening PR #7.
-- Run in Supabase SQL Editor against STAGING before applying the migration.
-- This script does not change database state.

-- 1) Confirm required columns exist.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'members' AND column_name IN ('id', 'branch_id'))
    OR (table_name = 'member_registrations' AND column_name IN (
      'id', 'personal', 'contact', 'family', 'church_life', 'spiritual',
      'consent', 'cell_group_id', 'user_id', 'first_name', 'last_name',
      'phone_primary', 'profile_photo_url', 'branch_id', 'membership_stage',
      'status', 'verification_status', 'submission_method', 'completeness_score',
      'ai_completeness_score', 'submitted_at'
    ))
    OR (table_name = 'registration_attempts' AND column_name IN ('ip_address', 'created_at'))
    OR (table_name = 'form_drafts' AND column_name IN ('id', 'user_id', 'session_id', 'form_key', 'form_data', 'expires_at'))
    OR (table_name = 'cell_groups' AND column_name IN ('id', 'branch_id', 'leader_name', 'leader_phone', 'address'))
    OR (table_name = 'follow_up_call_sessions' AND column_name IN ('id', 'member_id', 'initiated_by', 'recording_path', 'recording_url', 'transcript', 'created_at'))
    OR (table_name = 'follow_up_assignments' AND column_name IN ('id', 'member_id', 'assigned_to', 'assigned_by', 'status'))
    OR (table_name = 'follow_up_messages' AND column_name IN ('id', 'member_id', 'created_by', 'body', 'created_at'))
    OR (table_name = 'follow_up_calls' AND column_name IN ('id', 'member_id', 'called_by', 'outcome', 'call_date'))
    OR (table_name = 'member_stage_history' AND column_name IN ('id', 'member_id', 'old_stage', 'new_stage', 'changed_at'))
    OR (table_name = 'follow_up_communication_settings' AND column_name IN ('id', 'provider', 'messaging_enabled', 'calling_enabled', 'updated_by'))
    OR (table_name = 'user_roles' AND column_name IN (
      'user_id', 'role', 'branch_id', 'assigned_by', 'assigned_at'
    ))
    OR (table_name = 'profiles' AND column_name IN ('id', 'is_super_admin', 'updated_at'))
    OR (table_name = 'system_logs' AND column_name IN (
      'action', 'performed_by', 'performed_by_name', 'details'
    ))
  )
ORDER BY table_name, ordinal_position;

-- 2) Confirm every role referenced by the hardened role function exists in app_role.
SELECT e.enumlabel AS role_name
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' AND t.typname = 'app_role'
ORDER BY e.enumsortorder;

-- 3) Inspect all current policies on the affected tables. Remember permissive policies
-- are OR-ed together; look for any other broad member SELECT or registration INSERT policy.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('members', 'member_registrations', 'registration_attempts', 'user_roles', 'form_drafts', 'system_logs', 'profiles', 'cell_groups', 'follow_up_call_sessions', 'follow_up_assignments', 'follow_up_messages', 'follow_up_calls', 'member_stage_history', 'follow_up_communication_settings')
ORDER BY tablename, policyname;

-- 4) Inspect table privileges for the registration intake table.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'member_registrations'
  AND privilege_type = 'INSERT'
ORDER BY grantee;

-- 5) Check whether member photos are configured as a public bucket. If public=true,
-- object URLs bypass storage RLS; changing this requires migrating URL consumers to
-- authorized signed URLs, so do not change the bucket flag blindly.
SELECT id, name, public
FROM storage.buckets
WHERE id = 'member-photos';

-- Inspect all member-photo storage policies; no broad anon SELECT policy should remain.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual ILIKE '%member-photos%' OR with_check ILIKE '%member-photos%')
ORDER BY policyname;

-- 5) Check anon table privileges for form drafts. The result should contain no
-- SELECT/INSERT/UPDATE/DELETE grants to anon after the migration.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('form_drafts', 'cell_groups', 'follow_up_call_sessions', 'follow_up_assignments', 'follow_up_messages', 'follow_up_calls', 'member_stage_history', 'follow_up_communication_settings')
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;

-- 6) Inspect relevant function signatures and security properties.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_role', 'is_admin', 'is_pastoral',
                    'consume_registration_rate_limit', 'assign_user_role',
                    'approve_member_submission', 'prevent_profile_privilege_escalation',
                    'current_user_branch', 'can_access_member')
ORDER BY p.proname, arguments;

-- 7) Inspect EXECUTE grants for the new rate-limit function.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'consume_registration_rate_limit'
ORDER BY grantee, privilege_type;

-- Before applying the migration, verify:
-- * Every expected column above is present.
-- * app_role contains the intended roles supported by the UI and role-assignment function; legacy-role cleanup uses text comparisons to avoid enum casts.
-- * The current effective member SELECT policy set has no unexpected broad policy.
-- * The current registration insert policy/grants are understood.
-- * No anon policy grants access to form_drafts; the app uses auth.uid()-scoped drafts.
