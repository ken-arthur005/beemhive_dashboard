@AGENTS.md
# Beem Hive engineering context

## Authoritative scope

The owner explicitly removed all commerce on 7 October 2026. Purchases are offline.
Implement NFC item assignment, verified customer setup, private draft/publication,
QR/vCard, ownership history, analytics, suspension and controlled deletion.
No Paystack, storefront, checkout, product pricing or order subsystem.

One profile per customer; multiple items can resolve it. Canonical origin:
`https://beemhive.vercel.app`, configurable through NEXT_PUBLIC_APP_URL.
All existing customers must complete setup and explicitly publish. Every later
revision is private until published. Previous published snapshots remain live
until replaced or unpublished.

## Architecture

Next.js 16.3.6 App Router, JavaScript, React 19.2.8, Tailwind, Base UI-backed shadcn,
Supabase, Recharts and dnd-kit. Read installed Next docs before editing framework code.
Use `.impeccable.md` and DESIGN.md for the restrained amber/charcoal/Geist interface.

- `src/lib/supabase/client.js`: browser user client and verified session helper.
- `src/lib/supabase/server.js`: createUserClient (cookie-aware), createServiceClient
  (isolated privileged; server-only). The legacy createClient export is privileged.
- `src/lib/auth.js`: verified identity, exact role, active-account guards and CSRF.
- `src/lib/data.js`: checked query results, input validation, paginated directory reads.
- `src/lib/public-profile.js`: gated immutable publication resolution and event context.
- `src/lib/draft-save-queue.js`: serialized CAS autosave; newer edits stay dirty.
- `supabase/migrations`: baseline + additive lifecycle/setup migrations.

Browser clients must never write lifecycle/publication/setup fields or receive
service keys. APIs guard privileged operations and RPCs are service-only. Do not
infer setup from email confirmation, first login or editable Auth metadata.

## Invariants

1. Slugs and physical item records survive transfers/deletion.
2. Transfer creates assignment history and pauses the item.
3. Events belong to their assignment-at-event, not the current owner.
4. Public profile/image/contact resolution requires enabled nonretired item,
   active/setup-complete customer and a publication snapshot.
5. Photos use private immutable objects. Never overwrite a published photo.
6. Invitation and deletion workflows must resume after partial external failures.
7. Retire/suspend operationally; permanently delete only through confirmed cleanup.
8. Never apply DB-only lifecycle cutover beneath an incompatible old deployment.

See IMPLEMENTATION.md for API/RPC arguments, supabase/README.md for analytics and
DEPLOYMENT.md for release coordination. Standard Supabase email delivery is retained;
the token-hash template contract is in src/lib/supabase/SETUP_CONTRACT.md.

## Verification

`pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:ui`, `pnpm build`.
Integration tests require isolated localhost Postgres; never run them on production.
Browser tests mock APIs; validate real email/Auth/Storage and physical NFC/contact
imports separately before declaring release completion. No credentials in commits.
