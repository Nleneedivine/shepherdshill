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
  AND tablename IN ('members', 'member_registrations', 'registration_attempts', 'user_roles')
ORDER BY tablename, policyname;

-- 4) Inspect table privileges for the registration intake table.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'member_registrations'
  AND privilege_type = 'INSERT'
ORDER BY grantee;

-- 5) Inspect relevant function signatures and security properties.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_role', 'is_admin', 'is_pastoral',
                    'consume_registration_rate_limit', 'assign_user_role')
ORDER BY p.proname, arguments;

-- 6) Inspect EXECUTE grants for the new rate-limit function.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'consume_registration_rate_limit'
ORDER BY grantee, privilege_type;

-- Before applying the migration, verify:
-- * Every expected column above is present.
-- * Every role name in the migration's DELETE list is present in app_role.
-- * The current effective member SELECT policy set has no unexpected broad policy.
-- * The current registration insert policy/grants are understood.
