# Security hardening rollout

This branch intentionally changes access control. Do not merge or deploy until the staging checks below pass.

## Changes in this branch

- Removes the legacy permissive member SELECT policy that allowed every authenticated user to read all member rows.
- Removes the legacy broad member-management policy so pastoral read access does not automatically imply write/delete access.
- Revokes direct INSERT on member registrations from `anon` and `authenticated`; submissions must use the authenticated Edge Function.
- Adds an atomic database rate-limit function for registration attempts.
- Restricts admin role assignment to `admin`, `worker`, and `member`; protects super-admin accounts from admin callers.
- Requires the voice callback secret, validates callback identifiers, and restricts recording downloads to configured HTTPS hostnames with audio MIME types and a 20 MiB limit.

## Required Supabase secrets

Before deploying the voice webhook change, configure:

- `VOICE_CALLBACK_SECRET`: a long, random secret shared with the voice provider callback configuration.
- `VOICE_RECORDING_ALLOWED_HOSTS`: comma-separated exact hostnames from the provider's documented recording URLs, without schemes or paths. Only configure hosts confirmed by the provider. The handler fails closed for recording downloads until this is set.

The callback accepts `x-voice-callback-secret` where the provider supports custom headers. For compatibility, it also accepts the existing `?token=` query parameter. Query parameters can appear in access logs; migrate to a header if the provider supports it and rotate the secret after updating the provider configuration.

## Staging verification checklist

1. Apply migrations to a disposable/staging database first; do not apply directly to production.
2. As an ordinary authenticated member, verify direct SELECT of unrelated member records is denied and the member can still view their own permitted record.
3. As worker, pastoral-team, senior-pastor, admin, and super-admin accounts, verify only the intended read/write operations remain available.
4. Confirm pastoral roles can read authorized member records but cannot update/delete members unless separately authorized by the admin policy.
5. Confirm direct INSERT into `member_registrations` fails for both `anon` and `authenticated`; confirm the Edge Function still accepts a valid authenticated submission with valid Turnstile.
6. Confirm missing/invalid JWTs, missing Turnstile, malformed JSON, overlong fields, invalid UUIDs, and invalid consent are rejected.
7. Send concurrent registration requests and verify the database rate limit never accepts more than five attempts per hour for one IP or user.
8. Verify an admin cannot grant pastoral/super-admin roles, cannot modify a super-admin, and cannot change their own role. Verify a super-admin can perform the intended role-management operations.
9. Verify voice callback requests fail with 503 when the secret is absent, 401 for a wrong secret, and 400 for a missing call identifier.
10. Verify a recording URL on an unapproved host is never fetched, redirects are rejected, oversized recordings are rejected, and valid provider recordings are stored in the private bucket.
11. Exercise registration, approval, member search, follow-up assignment, call status updates, and recording playback end-to-end.
12. Confirm build, lint, TypeScript checks, and CI pass before merge.

## Operational caveats

- This branch has not been applied to a live database, and the app build or automated tests have not been run by this change.
- The current registration form expects a signed-in user. If anonymous registration is a product requirement, do not simply remove the JWT check: design a separate public intake path with robust CAPTCHA, schema validation, atomic rate limiting, and no client-controlled identity or privileged fields.
- The recording host allowlist must be based on the actual provider documentation and observed callback payloads; do not guess hostnames.
- Re-check the deployed database's effective policies after migration. RLS policies are permissive by default and are OR-ed together, so every legacy overlapping policy must be accounted for.
