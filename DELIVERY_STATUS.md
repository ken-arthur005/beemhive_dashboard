# Live NFC platform status — 11 October 2026

## Applied and deployed

- Lifecycle, publication, ownership, setup-grant, provisioning and cleanup schema/RPCs
  are applied to the linked BeemHive production Supabase project.
- Existing Auth users/profile data were preserved. The owner removed the old test
  customers/items before this cutover; the preserved baseline is 2 accounts, 1 admin
  role, 1 profile and 4 photo objects. The other account remains unassigned until its
  invitation/recovery verification provisions normal customer membership.
- Photo storage is private, with 5 MiB and JPEG/PNG/WebP limits and server-only object
  access. Four orphaned legacy objects are retained privately and backed up.
- The repaired application is deployed at https://beemhive.vercel.app.
  Production deployment: dpl_FXAiXxYzCHpa5MdPi71UbiHUS7go.
- Confirmation uses strict-origin referrer policy and 303 POST→GET redirects.
- Verified invitations automatically ensure the nonprivileged customer role,
  account and draft. Existing admins are preserved; metadata never selects admin.
- Recovery of previously Auth-invited accounts repairs incomplete provisioning.
- Invite/recovery templates use the token-hash confirmation route. Site URL matches
  production; confirmation, invitation and callback redirects are allowlisted.
- SMTP was inspected: custom Gmail SMTP is enabled on port 465, sender name BeemHive,
  with a 60-second per-user minimum interval. Credentials were not changed.
- A fresh setup/recovery email request for the owner's new account was accepted.
  Actual inbox receipt is left to the owner as requested.
- Deployment source excludes local backups, environment files, test caches and
  agent tooling. Clean deployment inventory contains no private source artifacts.

## Verification

- 123 unit/API tests pass; ESLint clean; local production build passes.
- Native-browser regression proves the real confirmation HTML produces a valid
  Origin and a 303 redirect navigates to a GET password page.
- 22 real-Postgres integration tests passed before the live cutover.
- Live isolated pilot passed actual GoTrue invitation verification, automatic
  customer membership, password setup, Storage upload, publication, private draft
  isolation, photo/vCard/QR delivery, suspension/unpublication revocation, actual
  sign-in, direct-RPC denial, backend-only admin promotion and cleanup.
- The disposable accounts/photos were removed; their synthetic retired items/events
  were purged specifically so launch analytics and item lists start clean.
- Final preserved state: 2 Auth users, 1 role, 1 profile, 0 items, 0 tap events,
  4 private legacy objects and no pending cleanup jobs.

## Backups and remaining handover

Application data, Auth directory metadata and all four photo binaries were copied
to ignored `.local-backups/2026-10-11T16-23-57-078Z`. This does not contain password
hashes and is not a replacement for a managed full-Postgres/PITR backup.

The owner handles inbox receipt and physical NFC/QR/iOS/Android contact-import tests.
Use the fresh email to set a password and verify normal customer sign-in first.
Admin promotion is a separate trusted backend role change after that test.

Known remaining constraints: personal Gmail SMTP has transactional deliverability
limits; leaked-password protection remains disabled pending plan availability;
one upstream development-only lint advisory remains documented in SECURITY.md.

Commerce remains removed. Marketing-site work is outside this NFC dashboard campaign.
No commits or pushes were performed during this cutover.
