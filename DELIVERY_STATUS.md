# NFC platform delivery status — 7 October 2026

## Implemented locally

- Verified auth/role/session handling and safe redirects; admin password recovery
  remains independent of customer activation.
- Durable invitation/provisioning retries and existing-customer item assignment.
- Private, revisioned autosave; explicit immutable publication and unpublication.
- Private/versioned photo handling, safe decoding and publication-gated delivery.
- Stable item URLs, ownership history, transfer pause, suspension and retirement.
- Confirmed permanent deletion with refreshed/retryable cleanup and PII redaction.
- Gated public profiles, native contact links, valid UTF-8 vCards and item QR codes.
- Assignment-at-event analytics, atomic view deduplication, UTC buckets and complete
  pagination. HEAD/prefetch/bot profile requests do not inflate view counts.
- Responsive/accessibility corrections, CI and operating/deployment documentation.
- Reference screenshots preserved under docs/design-references rather than served
  publicly. The application logo remains in public/.

Commerce was explicitly removed from scope. Marketing-site work is outside this
dashboard campaign and has not been declared delivered.

## Verification evidence

| Check | Latest result |
| --- | --- |
| Unit/API suite | 119 passed |
| Actual Postgres integration suite | 22 passed |
| Browser dashboard flows | 15 passed on Chrome; API responses mocked |
| ESLint | Passed without warnings |
| Production build | Passed on Next.js 16.3.6 / React 19.2.8 |
| Production dependency audit | No known vulnerabilities |
| Full dependency audit | One unpatched development lint advisory; SECURITY.md |

The Postgres tests use real transactions, RLS, constraints and concurrency, with
minimal Auth/Storage schema stubs. They do not verify hosted Auth/SMTP/Storage HTTP
behaviour. Browser tests validate production components using intercepted APIs.
Physical NFC scans and mobile vCard imports remain live-release acceptance checks.

## Live state and blockers

No live Supabase migrations or data modifications have been applied, and the
Vercel deployment has not been replaced. The latest live preservation check found
9 Auth users, 9 roles, 8 profiles, 6 items, 0 tap events and 4 Storage objects.
The live lifecycle tables are not present yet.

The local `.env.local` has public configuration and a random hash salt, but
SUPABASE_SERVICE_ROLE_KEY is empty. Vercel CLI reports Logged out. Permissions are
approved; application credentials and deployment authentication are still needed.

## Resume point

1. Configure the service-role/secret credential securely in ignored `.env.local`;
   authenticate Vercel and link the existing beemhive.vercel.app project.
2. Verify the Supabase email templates/redirect allowlist and recoverable backup.
3. Follow DEPLOYMENT.md for coordinated migration, application and private Storage
   cutover. Do not migrate the DB beneath the incompatible old application.
4. Run real email/Auth/Storage and physical-device acceptance, then send setup
   links to the six legacy customers. Every customer must explicitly publish.

No commits or pushes have been made. Secrets remain outside tracked files.
