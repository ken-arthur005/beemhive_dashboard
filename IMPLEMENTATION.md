# NFC platform implementation contract

Commerce is removed. Preserve users/profiles/items/slugs/media. One profile per customer. Every revision requires explicit Publish. All existing customers start setup-required and unpublished. Public origin is https://beemhive.vercel.app. Existing PRODUCT.md / DESIGN.md govern visual style.

## Shared server interfaces

- `@/lib/supabase/server`: `createServiceClient()` (sync privileged), `createUserClient()` (async cookie-aware), compatibility async `createClient()` for privileged legacy callers during transition.
- `@/lib/auth`: `requireUser(request, { role, allowSetup = false } = {})` resolves a verified user, exact role and active account; returns `{ user, role, account, supabase, userClient }`. `supabase` is privileged. Setup-incomplete customers may edit drafts; public publication requires setup. `allowSetup` permits activation while provisioning is incomplete, not suspension/deletion.
- `@/lib/http`: `HttpError(status,message,code)`, `apiError(error)`, `jsonResponse(data,status)`, `readJson(request)`, `assertSameOrigin(request)`.
- `@/lib/platform`: browser-safe `appOrigin()` and `itemUrl(slug)`; origin from NEXT_PUBLIC_APP_URL, default Vercel.
- All APIs use no-store responses, bounded input and guarded privileged operations. Browser clients do not write authoritative lifecycle/publication data.

## Data / RPC contract (service-role-only unless explicitly documented)

- `customer_accounts`: user_id, status ('active','suspended','deleting'), setup_completed_at, published_revision (nullable).
- Existing `profiles` are drafts; add revision bigint default 0 and photo_asset_id nullable. Keep content columns and legacy photo_url for preserved migration provenance.
- `profile_publications`: user_id, revision, content jsonb (same snake_case profile content keys), published_at; immutable snapshots unique(user_id,revision).
- `profile_media`: id, owner_id, bucket, object_path, content_type, byte_size, created_at. Private versioned objects. Register legacy referenced objects without deleting unmatched objects.
- `nfc_assignments`: id, nfc_item_id, owner_id nullable, started_at, ended_at. Existing items receive initial assignments; zero historical taps need backfill.
- `nfc_items`: add current_assignment_id nullable, version bigint default 0, retired_at nullable, operation_key uuid unique. owner_id nullable ON DELETE SET NULL; preserve slug; transfer pauses.
- `tap_events`: add assignment_id, event_type ('profile_view','contact_download'); make nfc_item_id nullable to reconcile SET NULL; preserve assignment histories.
- `provisioning_operations`: id UUID operation key, email, customer_name, product_type, slug, user_id nullable, status, last_error, created_at, updated_at. Supports reconciliation and retries, not public access.
- `setup_grants`: token_hash, user_id, expires_at, consumed_at, purpose. Server-issued after verified invite/recovery; no browser writes.
- `customer_deletions`: id, target_user_id (no cascading FK), actor_id nullable, status, object_inventory jsonb, last_error, created_at, completed_at. Resumable cleanup; redact target/inventory at completion.
- `lifecycle_audit`: actor_id/customer_id nullable, nfc_item_id nullable, action, reason, created_at.

RPCs (names/arguments must match; return JSON objects or scalar as specified):
- `ensure_customer(p_user_id uuid,p_name text)` -> void; preserve existing customer/profile, reject admin conflict, insert missing active account/role/draft.
- `save_profile_draft(p_user_id uuid,p_expected_revision bigint,p_draft jsonb)` -> profile JSON; ownership/media validation and compare-and-swap, increment revision. Input includes name,title,bio,links,show_save_contact,background,photo_asset_id. Reject suspension; enforce profile content constraints.
- `publish_profile(p_user_id uuid,p_revision bigint)` -> publication JSON; active/setup-complete, exact acknowledged revision, immutable snapshot + pointer atomically.
- `unpublish_profile(p_user_id uuid)` -> void; clear pointer, retain snapshots.
- `create_nfc_item(p_actor uuid,p_owner uuid,p_slug text,p_product_type text,p_operation_key uuid)` -> item JSON; admin checked, idempotent, customer checked, initial item enabled but publication gate controls exposure.
- `manage_nfc_item(p_actor uuid,p_item uuid,p_action text,p_expected_version bigint,p_target uuid default null,p_reason text default '')` -> item JSON; activate/deactivate/retire/transfer; lock item, preserve slug/history; transfer creates new assignment and pauses. Reactivation requires eligible owner/setup/publication.
- `set_customer_status(p_actor uuid,p_user uuid,p_status text,p_reason text default '')` -> account JSON; active/suspended only, no admin targets.
- `begin_customer_deletion(p_actor uuid,p_user uuid)` -> deletion JSON; mark deleting, revoke publication, unassign/retire items, close assignments, anonymize old event PII; repeat returns existing job.
- `finish_customer_deletion(p_actor uuid,p_job uuid)` -> void; after storage and Auth cleanup, redact job target/inventory and complete.
- `resolve_public_profile(p_slug text)` -> JSON or null: `{item_id,assignment_id,owner_id,revision,content}`; active/nonretired/currentowner/activeaccount/setup/publication required.
- `record_profile_event(p_slug text,p_event_type text,p_ip_hash text,p_device_type text,p_referrer text)` -> bool; same eligibility, item serialization, assignment-at-event, atomic sliding five-minute profile-view dedup; contact events separate, published preference enforced.
- `analytics_summary(p_customer uuid default null,p_days integer default 7,p_item uuid default null)` -> JSON: current/previous totals, today, contact downloads, device totals, daily/hourly buckets, card breakdown, latest event, admin leaderboard/recent activity. UTC calendar boundaries (Ghana UTC), filter events by assignment owner, never current owner. Nonnull customer for customer scope; null for admin. API caller checks authorization.

## Customer API contract

- GET `/api/customer/profile` -> `{profile,account,publication,items}`. `profile.photo_url` is authenticated preview endpoint, not Storage URL; `publication` nullable.
- PUT `/api/customer/profile` with `{expectedRevision,draft}` -> `{profile}`; 409 on conflict.
- POST `/api/customer/profile/publish` with `{revision}` -> `{publication,account}`.
- DELETE same -> `{success:true}`.
- POST `/api/customer/media` multipart `file` -> `{asset:{id,url}}`, validates 5MiB maximum JPEG/PNG/WebP and re-encodes to safe immutable JPEG. GET `/api/customer/media/[id]` delivers owned private preview.
- GET `/api/customer/items` -> `{items}` with status, canonical url, all-time assignment-owned totals/today/lastTap (not nested raw-event fetch).
- GET `/api/customer/analytics?days=7&item=uuid` -> analytics_summary JSON. `days=all` -> null.
- POST `/api/auth/setup` `{password}` -> `{success:true}` with verified purpose-bound setup grant. GET `/api/auth/session` -> `{user,role,account}` for guarded layouts.

## Admin API contract

- GET `/api/admin/nfc-items?page=1&search=&type=all&status=all` -> `{items,total,page,pageSize:10}`; each item includes ownerEmail,tapCount,version.
- POST same `{ownerId,slug,productType,operationKey}` -> `{item}` (existing-customer assignment).
- PATCH `/api/admin/nfc-items/[id]` `{action,version,targetOwnerId?,reason?}` -> `{item}`.
- DELETE same retires item, never physically deletes it.
- GET `/api/admin/customers?page=1&search=&status=all&sort=newest` -> `{customers,total,page,pageSize:10}`; name,email,status,setup_completed_at,published_revision,nfc_items,nfc_item_count, auth timestamps.
- GET `/api/admin/customer-options?search=` -> `{customers:[{user_id,name,email}]}`; paginated auth directory must not silently cap.
- PATCH `/api/admin/customers/[id]` `{status,reason}` -> `{account}`.
- DELETE same `{confirmEmail}` -> `{success:true,jobId}` only after cleanup; return failure/retry state honestly.
- POST `/api/invite` `{operationKey,email,customerName,productType,slug}` -> `{item,operationId}`. Resend `{mode:'resend',userId}` -> `{success:true}`; recovery/setup for established accounts. Reuse durable operation key on retry.
- GET `/api/admin/analytics?days=7` -> analytics_summary JSON.

## Public API

- `/t/[slug]` uses published snapshot only. Server-side qualified view logging; bots/prefetch/HEAD excluded, no-store caching.
- `/api/vcard?slug=` resolves eligibility and current owner, returns escaped UTF-8 vCard; userId interface denied.
- `/api/public/photo/[slug]` streams only current publication photo through eligibility gate; no-store, never Storage URL redirect.
- `/api/qr?slug=` authenticated current owner/admin -> PNG encoding canonical item URL; can prepare before publication but must label inactive/unpublished in UI.
