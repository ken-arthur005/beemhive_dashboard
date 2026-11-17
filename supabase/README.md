# NFC database implementation

## November 5 links and session security

The additive `20261105034956_expanded_platform_links.sql` and
`20261105035100_session_expiry_and_admin_mfa.sql` migrations expand the link catalog,
add service-only app sessions, and restrict authenticated reads by live session and
administrator MFA. They preserve existing content and the eight-link limit. Deploy
with the compatible app; see `docs/AUTH_SECURITY_AND_EMAIL.md` for rollout, recovery,
role-specific expiry, and still-pending Gmail SMTP configuration. Local tests do
not apply these migrations to a hosted project.

## October 31 profile feedback release

Apply `20261031222517_profile_feedback_and_unique_analytics.sql` **before** deploying
this application version. It adds `profiles.photo_shape`, Snapchat validation,
browser-event metadata and service-only tracking RPCs. Existing users, photos,
slugs, publications and event totals are retained; historical publications with
no photo shape continue to render as arches.

Set a stable server-only `ANALYTICS_SECRET` (32+ random characters), or retain the
existing `IP_HASH_SALT` as its fallback. Do not rotate this secret casually:
changing it invalidates visitor cookies and resets browser continuity.

Public views now record from a visible, hydrated published page, not from server
rendering. This avoids counting RSC rendering, previews, HEAD and prefetches as
visits. A signed, HttpOnly, Secure-on-HTTPS, SameSite=Lax cookie identifies a
browser for one year. The database stores only an owner-scoped hash in the
existing `ip_hash` column; new browser events are distinguished by non-null
`visit_id`. Existing deletion anonymization clears these hashes too. Repeated
visits have separate event UUIDs, while replaying an event UUID is idempotent.

`analytics_summary` preserves its old fields and additionally returns
`uniqueVisitors`, `repeatVisitors` (more than one visit in the selected period),
`trackedViews`, `legacyViews`, `totalClicks`, `uniqueClickers`,
`uniqueContactSavers`, `uniqueCtr`, and `contactConversionRate`. Daily/card rows
include `uniqueVisitors`. Period uniques are distinct over the period, not sums
of daily values. Unique metrics exclude legacy IP-only/unidentified events.
CTR/contact conversion count only browser identities with a view in the same
selected date/item scope; no denominator gives a null rate, displayed as `—`.
Across all items, one browser counts once per customer profile. Platform-wide
metrics count browser/profile pairs, not globally identified people.

Link clicks keep their real destinations (including phone/email). A same-origin
POST validates the published revision, link index and matching browser visit.
Contact downloads are recorded on the gated vCard request, not on button intent.
The legacy service-only event RPC remains available for compatibility and
unidentified contact downloads; it is not used for new browser views.

Phone drafts may remain incomplete. The application normalizes valid numbers to
E.164 on save and validates country-aware numbers/platform hosts before publish;
the database additionally requires international phone syntax on publication.

Verification uses isolated localhost Postgres (`pnpm test:integration`), not a
remote Supabase database. Apply migrations through the normal deployment process;
these checks do not deploy them.

These schema-only migrations preserve existing Auth users, profiles, NFC slugs,
and Storage objects. They do not include commerce, production credentials, or
data exports. No remote database changes are required to review or test them.

## Deployment sequence

1. Review the reconstructed baseline against the confirmed existing schema. It
   creates missing baseline tables without replacing existing data. Deployments
   that already track a baseline can mark it applied using their normal migration
   workflow; do not reset the existing database.
2. Apply `customer_nfc_lifecycle` using the normal reviewed deployment process.
   Existing customer accounts become active, setup-incomplete and unpublished.
   All existing items receive an initial assignment. If events have appeared since
   the inspected zero-event baseline, the migration fails transactionally and
   requires an explicit historical ownership backfill.
3. Deploy the application APIs that use the service-only RPCs and proxy private
   photos through publication/ownership eligibility checks.
4. Execute **`storage-cutover.sql` separately** after application coordination.
   This makes `profile-photos` private, sets a 5 MiB/MIME limit and denies browser
   object access, even in the presence of old permissive policies. Objects are
   retained. Until this step, legacy public object URLs are still public.

The baseline is reconstructed from confirmed structural facts, not an exact
`pg_dump`: old policy names were not available. The lifecycle migration removes
legacy policies on the four baseline application tables by catalog inspection,
then installs read-only ownership/admin policies and service-only write grants.
The baseline preserves nullable legacy profile fields and the historical
`tap_events` NOT NULL/SET NULL inconsistency; the additive migration fixes it.

## RPC behavior and errors

All twelve RPCs in `IMPLEMENTATION.md` use the exact documented arguments and
are executable only by `service_role`. They use `SECURITY INVOKER` with an empty
search path. The authenticated read-only `public.is_admin()` wraps a private,
identity-bound definer helper to avoid recursive roles RLS. Anonymous callers
cannot execute either helper or access application data.

- `40001`: stale profile revision or item version (API maps to HTTP 409).
- `42501`: role, account eligibility, media ownership, or setup failure.
- `22023`: invalid action, content, range, or transfer target.
- `23505`: operation-key payload conflict or duplicate slug.
- `23514`: immutable publication, retired item or incomplete deletion cleanup.
- `P0002`: missing item/customer/deletion job.

New items accept the existing product types `card`, `stand`, and `round_tag`.
Draft JSON accepts the existing editor's eight link types, eight links maximum,
120-character names, 160-character titles, 2,000-character biographies, bounded
HTTP(S)/phone/email URLs and solid-hex/two-color hex-gradient backgrounds. Blank
URLs can be saved as drafts but cannot be published. Publication content excludes
legacy `photo_url`; it carries `photo_asset_id` for gated streaming instead.
Media registry rows are append-only versions and owned assets must have a matching
Storage object before save/publication. The legacy registration uses exact URL
suffix equality (object names are not interpreted as SQL wildcard patterns).
An additional `profile_media.is_legacy` provenance flag permits registration of
existing referenced objects from the formerly unlimited bucket, including objects
with missing MIME metadata or larger sizes; new media defaults to `false` and
must satisfy the 5 MiB JPEG/PNG/WebP registry constraints. No object is rewritten.

Account rows are locked before item rows; multi-account locks use UUID order.
Event logging locks the eligible account and item before resolving the current
snapshot, recording assignment ownership and checking sliding five-minute view
deduplication. Contact downloads are separate and honor the published preference.
Hashless views are not deduplicated because unrelated anonymous visitors cannot
be distinguished. Item operation keys are bound to their original creation
assignment; transfer pauses the item and starts a fresh history segment.

Deletion jobs inventory all owner-prefixed objects, block publication, retire
current items and anonymize historical event hashes/referrers. The caller must
remove Storage objects using the Storage API and delete Auth via the Auth API.
`finish_customer_deletion` verifies both are gone, then redacts target/inventory.
Historical assignments/events remain, with owner IDs null after Auth deletion.

## Account setup and HTTP workflow additions

The `account_setup_workflow` migration supplies the service-only setup-grant claim,
Auth-success acknowledgement, atomic completion and release functions. It also
supplies provisioning leases, setup-email throttling, atomically resolved public
visits, deletion-inventory reconciliation, deletion absence verification and
active-account-fenced photo registration. Existing grants remain bound to their
verified user and purpose; browser writes/function execution are denied.

Setup completion does not publish a profile. Snapshot media remains immutable,
late uploads cannot register against a deleting account, and cleanup retries scan
remaining owner-prefixed objects. Provisioning name/email and related audit reasons
are redacted before the Auth cascade removes their owner association.

## Analytics JSON

`analytics_summary(p_customer, p_days, p_item)` uses UTC **calendar** days,
including today. Supported days are `7`, `30`, `90`, or SQL `NULL` (all time).
For finite ranges the previous range is the immediately preceding equal number
of UTC days. All-time previous totals are zero. Views and downloads are counted
separately, across the full SQL dataset, with historical assignment ownership.

```text
{
  days, rangeStart, rangeEnd, previousRangeStart,
  totalTaps, previousTaps, todayTaps,
  contactDownloads, previousContactDownloads, todayContactDownloads,
  allTimeTaps, lastTap,
  latestEvent: null | {id, created_at, event_type, device_type, nfc_item_id, assignment_id},
  deviceTotals: {mobile, desktop, tablet, unknown},
  daily: [{date: "YYYY-MM-DD", taps, contactDownloads}],
  hourly: [{hour: 0..23, taps, contactDownloads}],
  cards: [{id, slug, product_type, is_active, retired_at, version,
           tapCount, periodTapCount, today, contactDownloads,
           periodContactDownloads, lastTap}],
  leaderboard: [{id, slug, product_type, tap_count, period_taps, owner_id, owner_email}],
  recentActivity: [{id, created_at, device_type, event_type, nfc_item_id,
                   assignment_id, slug, owner_id, owner_email}]
}
```

`daily` is zero-filled, `hourly` always has 24 buckets. `tapCount`/card downloads
are all-time; period fields use the selected range. A former owner's card remains
in their history with only their assignment-owned counts. Customer leaderboard
and recentActivity are empty arrays; admin scope provides top 10 cards by period
views and 20 recent events. Recent owner identity comes from the event assignment,
not the item's current owner. `rangeEnd` is exclusive (next UTC midnight).

## Local integration tests

Install dependencies in the parent workflow. The harness requires `pg` and
`vitest`. Supply `TEST_DATABASE_URL` for an **isolated localhost Postgres** and run:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:55439/postgres'
npx vitest run tests/database.integration.test.js
```

The harness refuses remote hosts, creates a uniquely named test database, installs
minimal Auth/Storage/role stubs and deletes only that test database afterward.
It never resets the supplied database and never connects to a Supabase remote.
The connection user therefore needs permission to create databases and the three
test roles. Stubs model database permissions and cascades; these tests do not
exercise the separate Auth/Storage HTTP services.
