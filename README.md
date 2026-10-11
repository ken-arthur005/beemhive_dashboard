# Beem Hive NFC platform

Offline sales → admin assignment → account setup → private draft → explicit publication → NFC/QR profile → attributed analytics.

E-commerce, Paystack, checkout, catalogue pricing and orders were explicitly removed from scope on 7 October 2026. One customer has one editable profile and may own multiple physical items. Every item keeps its stable `/t/{slug}` URL.

## Development

Use Node 22.17+ and pnpm 12.5.1. Install with `pnpm install --frozen-lockfile`.
Copy `.env.example` to the ignored `.env.local`, configure Supabase public credentials,
the **server-only** service-role key, a random IP hash secret of at least 32 characters,
and the public origin. The current canonical origin is `https://beemhive.vercel.app`.

```text
pnpm dev
pnpm lint
pnpm test
pnpm build
```

The application requires the lifecycle migrations to be deployed. Never reset the
existing Supabase project to make a local environment work. Ordinary server-user
clients respect RLS; only guarded server operations use the isolated service client.

## Database and validation

The patched framework is Next.js 16.3.6 with React 19.2.8. Compatibility CSS for
the generated Base UI components lives in `src/app/component-variants.css`;
the shadcn generator is not an application dependency. Regenerate components
with a separately invoked, reviewed generator version when needed.

See [`supabase/README.md`](supabase/README.md) for the baseline, migration order,
RPCs, analytics shape and separate Storage cutover. The migration baseline is a
schema reconstruction, not a backup of Auth credentials or customer content.

Integration tests create and destroy their own uniquely named database on an
isolated **localhost** PostgreSQL server. They refuse remote database URLs:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/postgres'
pnpm test:integration
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:ui
```

`pnpm test` covers request/auth boundaries, autosave, contact serialization and
image sanitization. Integration tests exercise actual Postgres constraints,
transactions, RLS, concurrency, publication and deletion. Browser tests import
production dashboard components but mock API responses; they are not a substitute
for a real Auth/email/Storage smoke test.

## Customer workflow

1. Admin invites a new customer or assigns an item to an existing customer.
2. The customer follows a verified invite/recovery link and sets their password.
3. All edits, including photo uploads, remain in a private revisioned draft.
4. Publish saves pending edits and atomically captures the acknowledged revision.
5. Later edits do not change the last published snapshot. Unpublish blocks all
   public profile, contact and image endpoints without deleting the draft.

All six legacy customers must complete setup and publish after cutover; no legacy
publication is automatically granted. Admins retain their existing roles.

## Item/customer operations

- Additional items reuse the customer's account and profile.
- Transfer preserves the slug and historical assignment attribution, then pauses
  the item until explicit admin reactivation.
- Suspension blocks mutations/public exposure without changing item-specific flags.
- Retirement retains the physical item record and URL.
- Permanent customer deletion is a separate confirmed workflow. It blocks access,
  retires/unassigns owned items, cleans media/Auth and redacts personal history.
  Pending cleanup jobs remain visible and retryable after Auth removal.

## Production cutover

The production cutover was completed on 11 October 2026. Current live verification,
email configuration and owner handover steps are in DELIVERY_STATUS.md.

See [`DEPLOYMENT.md`](DEPLOYMENT.md). Auth email templates must use the supplied
token-hash confirmation links; default fragment-only links do not attest setup.
Configure secrets through local/deployment environment settings, never Git or chat.
Existing published URLs become setup-required at cutover, intentionally.

`IMPLEMENTATION.md` records API contracts. `.impeccable.md`, `PRODUCT.md` and
`DESIGN.md` record the interface direction.
