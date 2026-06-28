@AGENTS.md
# Beem Hive — CLAUDE.md

## What this project is

Beem Hive is an NFC product platform. The client sells physical NFC cards, stands, and round tags. Each card is linked to a unique URL (`/t/{slug}`) that opens a digital profile page when tapped. The admin panel lets the business owner create and manage NFC items and customers. Customers log in to build their profile and view their tap analytics.

There is no e-commerce store in this build. Orders are handled offline — the admin manually creates NFC item records for each customer.

---

## Tech stack

- **Framework:** Next.js (App Router) — JavaScript, not TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Backend/DB/Auth/Storage:** Supabase
- **Email:** Resend
- **Drag to reorder:** dnd-kit
- **Charts:** Recharts
- **Deployment:** Vercel

---

## Folder structure

```
/
├── app/
│   ├── (admin)/                  # Admin panel — route group, layout-protected
│   │   ├── layout.js             # Admin sidebar layout
│   │   ├── nfc-items/
│   │   │   └── page.js           # NFC items table + create form
│   │   ├── customers/
│   │   │   └── page.js           # Customer list
│   │   └── analytics/
│   │       └── page.js           # Platform-wide analytics
│   │
│   ├── (customer)/               # Customer dashboard — route group, layout-protected
│   │   ├── layout.js             # Customer sidebar layout
│   │   ├── profile/
│   │   │   └── page.js           # Profile builder
│   │   ├── my-cards/
│   │   │   └── page.js           # Customer's NFC items + NFC Tools instructions
│   │   └── analytics/
│   │       └── page.js           # Personal tap analytics
│   │
│   ├── (auth)/                   # Auth pages — no sidebar layout
│   │   ├── login/
│   │   │   └── page.js           # Shared login page (redirects by role after sign-in)
│   │   ├── invite/
│   │   │   └── page.js           # Customer invite accept — set password from token
│   │   └── reset-password/
│   │       └── page.js           # Password reset
│   │
│   ├── t/
│   │   └── [slug]/
│   │       └── page.js           # Public NFC profile page — SERVER COMPONENT
│   │
│   ├── layout.js                 # Root layout
│   └── page.js                   # Root redirect — sends to /login
│
├── components/
│   ├── admin/                    # Components used only in admin panel
│   ├── customer/                 # Components used only in customer dashboard
│   ├── shared/                   # Components used in both (e.g. analytics charts)
│   └── ui/                       # shadcn/ui generated components — do not edit manually
│
├── lib/
│   ├── supabase/
│   │   ├── client.js             # Browser Supabase client — uses ANON key
│   │   └── server.js             # Server Supabase client — uses SERVICE ROLE key
│   └── utils.js                  # cn() helper and shared utilities
│
├── middleware.js                  # Route protection — reads session, guards /admin and /customer routes
└── public/
```

---

## Supabase setup

### Two clients — critical distinction

**`lib/supabase/client.js`** — browser client, uses the public anon key, always respects RLS. Use this in Client Components for anything a logged-in user does (editing their profile, reading their own data).

**`lib/supabase/server.js`** — server-only client, uses the service role key, bypasses RLS entirely. Use this ONLY in Server Components and API routes for trusted operations: reading a profile by slug for the public page, logging tap events, sending invites. Never expose the service role key to the browser.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Never prefix with NEXT_PUBLIC_
RESEND_API_KEY=
```

---

## Database schema

### `users_roles`
Stores role per user. One row per user — either `admin` or `customer`.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | Primary key. FK → auth.users.id |
| role | text | `'admin'` or `'customer'` only |
| created_at | timestamptz | Default: now() |

### `profiles`
Holds all the content shown on the public `/t/{slug}` page.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | Primary key. FK → auth.users.id |
| name | text | Display name |
| title | text | Job title or tagline |
| bio | text | Short bio |
| photo_url | text | URL to image in Supabase Storage — not the image itself |
| links | jsonb | Ordered array of link objects: `[{type, url, label}]` |
| show_save_contact | bool | Default: true. Toggles vCard download button on profile page |
| updated_at | timestamptz | Default: now() |

### `nfc_items`
One row per physical NFC card/stand/tag.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. Default: gen_random_uuid() |
| slug | text | Unique. Goes in the URL: /t/{slug}. Written to the NFC chip via NFC Tools. |
| product_type | text | `'card'`, `'stand'`, or `'round_tag'` |
| owner_id | uuid | FK → auth.users.id — who this card belongs to |
| is_active | bool | Default: true. Admin kill switch. Inactive = profile page shows "card not active" |
| created_at | timestamptz | Default: now() |

### `tap_events`
One row per visit to `/t/{slug}`. Raw analytics data.

| Column | Type | Notes |
|---|---|---|
| id | bigint | Primary key. Auto-incrementing. |
| nfc_item_id | uuid | FK → nfc_items.id |
| created_at | timestamptz | Default: now(). Main field for time-series charts. |
| device_type | text | `'mobile'` or `'desktop'` — derived from user-agent |
| referrer | text | Where the visitor came from. Nullable. |
| ip_hash | text | Hashed IP — for deduplication only. Never store raw IPs. |

---

## RLS policies

RLS is enabled on all four tables. The `is_admin()` helper function handles admin access checks safely (security definer, language sql, stable).

### `user_roles`
- SELECT: `user_id = auth.uid()` (own role)
- SELECT: `is_admin()` (admin sees all)

### `profiles`
- SELECT: `user_id = auth.uid()` (own profile)
- SELECT: `is_admin()` (admin sees all)
- UPDATE: `user_id = auth.uid()` / WITH CHECK: `user_id = auth.uid()`

### `nfc_items`
- SELECT: `owner_id = auth.uid()` (own cards)
- SELECT: `is_admin()` (admin sees all)
- UPDATE: `is_admin()` (admin only)

### `tap_events`
- SELECT: `exists (select 1 from nfc_items where nfc_items.id = tap_events.nfc_item_id and nfc_items.owner_id = auth.uid())` (own card taps)
- SELECT: `is_admin()` (admin sees all)

---

## User roles and routing

There are two roles: `admin` and `customer`. After login, check the user's role in `users_roles` and redirect accordingly:

- Admin → `/admin/nfc-items`
- Customer → `/customer/profile`

Middleware guards `/admin/*` routes (admin only) and `/customer/*` routes (customers only). Unauthenticated requests to either redirect to `/login`.

---

## Public profile page — `/t/[slug]`

This is a **Server Component**. It must:

1. Fetch the NFC item by slug using the **service role client** (visitor is not logged in)
2. Log the tap event **server-side**, before rendering — do not use useEffect or client-side JS for this
3. If `is_active = false` — render a "This card is not currently active" page, do not show the profile
4. Fetch the linked profile and render it
5. If slug doesn't exist — return a 404

Tap deduplication rule: if `ip_hash` + `nfc_item_id` combination already has a tap within the last 5 minutes, skip inserting a new `tap_events` row.

---

## Key conventions

- Use **Server Components** by default. Only add `'use client'` when the component genuinely needs browser APIs, event handlers, or React state.
- All Supabase queries in Server Components use `lib/supabase/server.js`. All queries in Client Components use `lib/supabase/client.js`. Never mix these up.
- shadcn/ui components live in `components/ui/` and are never edited directly — extend them by wrapping in a new component.
- Analytics charts are built with Recharts and live in `components/shared/` since both admin and customer use them with different data.
- The drag-to-reorder links feature in the profile builder uses **dnd-kit**. Do not build a custom drag system.
- vCard files (`.vcf`) for the save contact button are generated on-demand in a route handler — they are never stored.
- All slug values are lowercase alphanumeric only, no spaces or special characters.

---

## NFC card programming

Cards are programmed manually by the client using **NFC Tools** (iOS/Android). Your system does not write to the chip. When the admin creates an NFC item, the generated URL (`https://beemhive.com/t/{slug}`) must be displayed clearly with a copy button. Include step-by-step NFC Tools instructions inline.

---

## What has been built

- [x] Database schema — all 4 tables created in Supabase
- [x] RLS enabled on all 4 tables
- [x] `is_admin()` function created
- [x] All RLS policies written and tested

## What still needs to be built

- [x] Supabase client setup (`lib/supabase/client.js` + `lib/supabase/server.js`)
- [x] Auth config in Supabase dashboard (invite redirect URLs, email templates)
- [x] Middleware — route protection
- [ ] Login page, invite accept page, password reset page
- [x] Admin layout + sidebar
- [x] Admin: create NFC item form
- [x] Admin: NFC items table
- [x] Admin: customer list
- [ ] Admin: platform analytics
- [x] Customer layout + sidebar
- [x] Customer: profile builder (photo, bio, links, drag-to-reorder, live preview)
- [] Customer: my cards page
- [ ] Customer: personal analytics
- [ ] Public: `/t/[slug]` profile page + tap logging
- [ ] Email templates via Resend
- [ ] Supabase Storage bucket for profile photos
- [ ] vCard generation route handler
- [ ] Final deployment + custom domain