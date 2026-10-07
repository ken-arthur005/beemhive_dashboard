# Coordinated deployment and handover

## Current delivery state

Application code and migrations are implemented and locally validated. The linked
live Supabase database has **not** been migrated. The Vercel production deployment
has **not** been replaced. A service-role credential and Vercel authentication are
required for coordinated cutover; Supabase MCP database access alone does not
configure the application's environment or grant access to Auth email templates.

## Prerequisites

1. Supply SUPABASE_SERVICE_ROLE_KEY in ignored `.env.local` and Vercel settings.
   Keep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY public; never prefix the secret key.
2. Authenticate Vercel and link the existing project serving beemhive.vercel.app.
3. Configure NEXT_PUBLIC_APP_URL=https://beemhive.vercel.app and a fresh random
   IP_HASH_SALT (32+ characters) in production.
4. Verify the Supabase Site URL/redirect allowlist and invite/recovery templates
   in `src/lib/supabase/SETUP_CONTRACT.md`. Verify SMTP/template capabilities.
5. Obtain/verify a recoverable hosted database backup. The checked-in schema
   baseline is not a customer-data or Auth backup. Record counts and identifiers.
6. Exercise migrations and actual Auth/email/Storage flows in an isolated staging
   Supabase environment before production. Local tests use Auth/Storage DB stubs.

## Release sequence

1. Run lint, unit, isolated database, browser and production-build checks.
2. Re-inspect production schema/counts; preserve existing remote migration history.
   Reconcile the reconstructed baseline rather than resetting or replaying old
   remote migrations. Initial inspected state: 9 users, 3 admins, 6 customers,
   8 profiles, 6 active items, 0 tap events and 4 photo objects.
3. Prepare the new Vercel release and maintenance/cutover window. The lifecycle
   migration revokes legacy direct browser writes: the old app is incompatible.
4. Apply reviewed lifecycle then setup-workflow SQL as tracked migrations. The
   zero-history guard deliberately fails if tap events have appeared; do an
   explicit historical backfill rather than silently guessing ownership.
5. Activate the compatible deployment and execute `supabase/storage-cutover.sql`
   in the same coordinated window. Objects are preserved, bucket access becomes
   private, and size/MIME limits plus restrictive object policies are enforced.
6. Verify 3-admin access and reconcile all existing accounts/profiles/items/objects.
   Existing customer publications are intentionally absent until setup/publish.
7. Send customer setup emails only after the templates and deployment are verified.
8. Pilot a new invite and repeat-customer assignment, publish revision A, edit B,
   verify A stays live, publish B, then unpublish. Confirm photo/vCard revocation.
9. Verify transfer pause/reactivation, suspension, cleanup retries and analytics.
   Validate NFC/QR on actual phones and vCard imports on iOS/Android.
10. Run Supabase security/performance advisors after DDL and review results.

## Recovery and operating procedures

- Provisioning retry: reuse the stored operation key; do not recreate/delete accounts
  to compensate for Auth/email errors. Use resend setup for established accounts.
- Cleanup retry: use Customers → Pending customer cleanup. Inventory is refreshed
  so late owner-prefixed uploads are reconciled; completion verifies Auth/Storage
  absence. The unmatched legacy object is preserved for separate investigation.
- Draft conflict: reload/reconcile, review retained local changes, then save again.
- Transfer: the physical URL is retained, historical ownership stays fixed and the
  item remains paused until an eligible recipient is explicitly reactivated.
- Unpublish/suspend: all public surfaces resolve current eligibility, including
  images and contacts; no public Storage URLs or reusable signed URL redirects.

After lifecycle cutover, do **not** roll back to the old app's direct writes/public
profile reads. Retain maintenance/private gating and deploy a forward fix, or use
the verified coordinated backup/restore procedure. Previously downloaded public
photo copies cannot be recalled by making the bucket private.

## Monitoring and unresolved external checks

Watch API failures, failed provisioning operations, pending deletion jobs, setup
errors and photo cleanup failures through Vercel/Supabase logs. Configure production
alert delivery and ownership in those services. Leaked-password protection was
disabled in the original Auth advisories; enable if supported by the account plan.

Hosted deployment, real SMTP/OTP behaviour, backup recovery, production alerts and
physical-device imports require external verification and are not certified by
mocked browser tests or the local production build.
