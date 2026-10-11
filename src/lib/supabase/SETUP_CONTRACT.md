# Auth integration contract and deployment prerequisites

Implementation targets installed Next 16.3.6, `@supabase/ssr` 0.12.0 and
`@supabase/supabase-js` 2.108.1. No dependency or migration changes are included.

## Database owner: required setup-grant extension

The five fields in IMPLEMENTATION.md are retained: `token_hash` (unique text
SHA-256 hex), `user_id` (UUID), `expires_at` (timestamptz), `consumed_at`
(nullable timestamptz), `purpose` (text constrained to `invite`, `recovery`).
Add nullable `claim_id` UUID, `claim_expires_at` timestamptz and
`password_updated_at` timestamptz. These distinguish an in-flight Auth request
from a durable Auth success whose account finalization needs retrying. Never
store the plaintext capability, password, or a client-controlled completion flag.

Enable RLS, revoke all access from PUBLIC/anon/authenticated, and give service_role
the required table permissions. Only the server inserts grants after `verifyOtp`.
Expose these RPCs to service_role only (including revoking default PUBLIC execute):

All four take **exactly** `p_token_hash text, p_user_id uuid, p_claim_id uuid`.
They must lock the grant and account rows, check user binding, invite/recovery
purpose and expiry against database time. Customer flows require the exact customer
role and an active account. Admins may use verified recovery grants only; their
password reset consumes the grant without creating customer setup/publication state.
Serialize claims per customer too, so two separate grants cannot concurrently
change a user's password. Reject missing/inactive accounts; never reactivate them.

1. `claim_setup_grant` -> JSON `{state:'ready'|'password_updated'|'completed'}`.
   Atomically claim an unconsumed grant with the supplied UUID and a two-minute
   lease. Reject competing live claims (`grant_busy`); permit reclaim after expiry.
   If `password_updated_at` exists, return `password_updated` and allow immediate
   claim reassignment: only DB finalization remains. A consumed grant returns
   `completed` only if the matching active account is already setup-complete;
    it must never authorize a second Auth update. A consumed admin recovery grant can
    acknowledge its committed reset without requiring a customer account. All results still check expiry.
   Claims with no recorded Auth success stay locked until expiry on unknown Auth
   outcomes. The application bounds user-client network requests to 20 seconds.
2. `mark_setup_password_updated` -> JSON `{success:true}`. Require the matching
   live claim, unconsumed/unexpired grant, active customer; record server time.
   Idempotent for the same claim. Called only after Auth succeeds (or Auth verifies
   the same submitted password on a retry after an ambiguous earlier success).
3. `complete_setup_grant` -> JSON `{success:true}`. Require the claim and durable
   `password_updated_at`. In one transaction set `setup_completed_at` only if null
   and set `consumed_at`; preserve status and publication. Make finalization
   idempotent after a committed transaction whose HTTP response was lost.
   Recheck active status here to reject suspension/deletion during the Auth call.
4. `release_setup_grant` -> JSON `{success:true}`. Release only the matching claim
   with no recorded Auth success, for a definite password-policy/reauthentication
   rejection. Never erase `password_updated_at` or resurrect a consumed grant.

RPC errors use message markers `invalid_grant`, `grant_expired`, `grant_busy`,
`account_inactive`. Other failures produce a retryable 503, never false success.
Expiry limits even partial-success retries: after expiry, request another email.
Cleanup may delete expired grants once any in-flight lease has ended.

These fields/RPCs are implemented in the lifecycle/account-setup migrations and
verified by real-Postgres integration tests, including competing claims, partial
success, expiry and suspension. The application fails closed until those migrations
are deployed. Mock tests separately verify the Auth/HTTP sequencing.

## Invitation API owner: new and existing customer email contract

Keep the existing Supabase email delivery. For **new Auth users**, call
`service.auth.admin.inviteUserByEmail(email, { redirectTo:
appOrigin() + '/auth/confirm?type=invite', data: {full_name: customerName} })`.
Finish/reconcile customer provisioning through `ensure_customer` before treating
the invitation operation as complete. A click arriving early has a pending UI;
it does not grant a customer role from user metadata or activate a blocked account.

For **existing Auth users** (including existing setup-required customers), send
`resetPasswordForEmail(email, {redirectTo: appOrigin() +
'/auth/confirm?type=recovery'})` using an isolated publishable-key Auth client.
Do not reinvite an established Auth user. Resend must use the server-verified
target user ID/email and preserve the durable provisioning operation contract.
Recovery grants may complete first-time setup as well as change an established
customer's password. Neither flow can enable suspended/deleting customers.

## Supabase dashboard: required plain email templates

Set Site URL to `https://beemhive.vercel.app` (or the configured application origin).
Allow the deployment's `/auth/confirm` and `/auth/callback` destinations and the
corresponding explicit development origins. Use these links in the standard
Supabase templates; do not use `.ConfirmationURL` or fragment-only sessions:

Invite user:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Activate your account</a>
```

Reset password (also existing-customer setup/resend):

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Set your password</a>
```

Verified invite completion automatically calls the service-only ensure_customer RPC
after GoTrue verifies identity, repairing the role/account/draft without selecting
privileges from metadata. Existing admin roles are never overwritten. Recovery for
Auth-invited accounts can also reconcile incomplete provisioning.

GET/HEAD confirmation displays a native Continue form without consuming the token;
only the explicit same-origin POST verifies it, preventing ordinary email-link
prefetch from burning the single-use credential. Its referrer policy is strict-origin
so native POST Origin remains valid while token-bearing paths are not sent as
referrers. Both POST outcomes redirect with 303, not method-preserving 307.
The server verifies the OTP once,
persists an independent 30-minute cryptographic
grant, then sets a Secure (production), HttpOnly, SameSite=Lax cookie. Retries use
that grant, not the single-use OTP. GET setup never accepts an ordinary browser
session alone. PKCE callback exchanges a code and verifies getUser, but does not
mint a purpose grant from caller-controlled `next`, `type`, or metadata.

If OTP verification succeeds but the grant insert fails, the consumed OTP cannot
be replayed: the UI honestly asks for a fresh email. Supabase/email-provider link
prefetchers do not consume OTPs through this GET/HEAD confirmation page.

**Blocker:** configure the templates before sending invitations/reset emails.
Supabase's June 2026 policy restricts template customization for new Free projects
on default SMTP; verify this project's existing template access. If restricted,
custom SMTP configuration is needed; no Resend dependency is required here.

## Dashboard/layout owners

Use `getAuthSession()` from `@/lib/supabase/client` (GET `/api/auth/session`) in both
browser layouts instead of getSession/user-role queries. It returns verified
`{user:{id,email},role,account,pending,setupRequired}`. Enforce exact admin/customer
roles, render a terminal pending state when `pending`, and show account setup
status. Setup-incomplete **active** customers may edit `/customer/profile` drafts;
publication separately requires completion. On 401/403 show login/error, not
opposing-role redirect loops. Session endpoint signs out blocked cookie sessions.
Both dashboard layouts use this verified endpoint. Proxy covers auth/dashboard
pages; APIs enforce their own guards.

## Verification

`node node_modules/vitest/vitest.mjs run --config tests/auth.config.mjs`

Official sources consulted:
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/getting-started/ai-skills.md
- https://github.com/supabase/agent-skills/blob/main/skills/supabase/SKILL.md
- https://supabase.com/changelog
- Installed Next docs: Proxy, cookies, Route Handlers; installed SSR types/source.
