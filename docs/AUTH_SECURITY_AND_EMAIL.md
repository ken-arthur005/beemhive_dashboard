# Sessions, administrator MFA, and branded email

## Deploy together

Apply these additive migrations, in order, before activating the compatible app:

1. `20261105034956_expanded_platform_links.sql`
2. `20261105035100_session_expiry_and_admin_mfa.sql`

Do not reset the database or rewrite existing publications. Reconcile against actual
remote migration history using the coordinated release procedure in `DEPLOYMENT.md`.
No hosted migration, Auth configuration, DNS change, or deployment is performed by
the local tests. Missing security RPCs fail closed with a retryable 503.

The link catalog contains the reference's 28 unique choices plus Custom. WhatsApp
is listed once; the existing eight-links-per-profile limit remains. Application
validation checks platform hosts before publication. The SQL validator preserves
actual link types and all previous draft, URL, ownership and publication bounds.

## Session policy

| Role | Inactivity | Absolute lifetime |
| --- | --- | --- |
| Admin | 30 minutes | 8 hours |
| Customer (including pending setup) | 24 hours | 7 days |

The earliest deadline wins. `public.app_sessions` is service-only and keyed by the
verified JWT's `session_id`. The server verifies identity and signed claims, then
checks that the session still belongs to that user in `auth.sessions`. The start
time comes from the real Auth session, not a refreshed token or the first app visit.
Old sessions may therefore require a new sign-in immediately after release.

The application checks expiry before every authenticated API operation and private
page entry. Only explicit same-origin activity POSTs extend inactivity. A heartbeat
without real input, GET polling, automated scrolling, and token refresh do not count.
Expired sessions are durably revoked before returning a denial, so concurrent touch
requests cannot revive them. A new login creates a different session ID.

Restrictive RLS policies also gate the existing authenticated Data API reads using
the caller's `auth.uid()`, JWT session ID, account status and administrator AAL2.
The private identity-bound definer reads session/role rows to avoid recursive RLS;
it has an empty search path and no writes or caller-controlled identity arguments.
Browser callers cannot access the session registry or execute the service-only RPC.
Keep the existing private Storage cutover in place. Public NFC profile, contact and
photo routes retain their existing publication eligibility, independent of login.

The browser warns two minutes before expiry, synchronizes checks across tabs, and
locks the workspace after expiry. Reauthentication opens a new tab so an editor's
unsaved changes remain only in its existing React state, not localStorage. Resume
requires the same verified user and, for admins, MFA. Closing/reloading the editor
still discards unsaved changes. Never use a browser timestamp as authorization.

No Supabase paid-plan session setting is required. Keep JWT lifetime at the normal
provider default; shortening JWT expiry alone does not implement these policies.

## Administrator MFA

Enable/verify Supabase Auth TOTP enrollment and verification. The application uses
the installed SDK's native enrollment, factor listing, and challenge/verification.
No SMS provider, new authentication service, or custom OTP-secret database is used.

Every administrator must enroll and complete an authenticator check before entering
the workspace or invoking privileged APIs. `/api/auth/session` exposes only minimal
verified account/security status before MFA; the purpose-bound setup endpoint can
process a verified recovery grant without granting admin business access. A password
reset does not satisfy MFA. No caller can assert AAL through metadata or request JSON.

First-time enrollment is an explicit action, not an effect that duplicates factors
under React Strict Mode. Only unfinished factors can be discarded during setup.
Existing verified factors cannot be replaced by knowing the password. QR/setup keys
are displayed only during enrollment and must never be logged or saved in browser
storage. Save the key in a secure password manager or backup authenticator before
confirming enrollment. Customers have no new MFA enrollment requirement or screens.

### Recovery and rollout

1. Confirm a trusted business owner retains Supabase project access independently
   of their Beem Hive app account. Protect that project access with its own MFA.
2. Enroll one administrator in staging and test a real TOTP challenge, wrong/expired
   codes, a new browser, password recovery, and denied direct API access at AAL1.
3. Ensure each production administrator has a securely stored backup authenticator
   or setup key before completing enrollment. Do not lock out the only operator.
4. If all authenticator copies are lost, a trusted project operator must verify
   the person's identity out of band. A password-reset email or mailbox access alone
   is not enough. Record the approval without storing passwords, keys or OTPs.
5. Using `auth.admin.mfa.deleteFactor({ userId, id })` in trusted operator tooling,
   remove only the approved account's lost factors. Supabase documents that deleting
   a verified factor logs out all that user's active Auth sessions. Also mark all
   that user's app-session rows revoked. Keep service credentials server-only.
   Notify the account owner, then require a fresh password sign-in and new MFA enrollment.
6. Never add an AAL bypass flag, change the user's role as a recovery shortcut, or
   expose an unauthenticated "disable MFA" route. Do not silently disable MFA for
   the whole project to recover one account. A second approved project operator
   should be available for the business owner's own recovery.

Recovery is intentionally an operator procedure, not a new automatic bypass or
custom recovery-code subsystem. Validate actual hosted Auth behavior in staging;
local Postgres uses Auth-schema stubs, not the GoTrue HTTP service.

## Simplest branded-email setup (pending domain/provider)

The approved destination is **beemhive305@gmail.com**. The actual branded domain
has not been supplied; do not invent a sender, change DNS, or send customer emails
until the owner confirms the domain and sender address.

1. Verify the owner's sending domain with a transactional provider supporting SMTP.
   Configure its SPF/DKIM records and an appropriate DMARC policy without creating
   duplicate SPF records or overwriting existing mail routing.
2. In Supabase Auth, configure **custom SMTP**, sender name **Beem Hive**, and the
   verified branded sender address. Preserve the invite/recovery templates and
   explicit confirmation flow in `src/lib/supabase/SETUP_CONTRACT.md`.
3. At the domain's inbound mail/forwarding provider, create an alias for that exact
   branded sender address forwarding to **beemhive305@gmail.com**. SMTP sending and
   inbound forwarding are different services; a sending-only provider does not
   automatically receive or forward replies. Coordinate MX changes with existing mail.
4. Leave Reply-To unset (or equal to the branded sender). Recipients reply to the
   branded address and the inbound alias forwards those replies to Gmail. No custom
   Auth email hook, Gmail SMTP password, or application forwarding code is needed.
5. Enable the relevant built-in Auth security notifications (password/email changes
   and MFA enrollment/removal where supported) and verify they use the same sender.
   There is no separate general application-notification email engine in this repo;
   any future one must use the same approved sender/provider.
6. Test an actual new invitation, existing-customer setup/reset, password reset and
   security notification to an external mailbox. Reply to each and confirm arrival
   in Gmail; inspect sender authentication and spam delivery. Check the provider's
   bounce handling and Supabase rate limits. Never put SMTP credentials in public env vars.

Forwarding delivers incoming replies to Gmail; it does not configure Gmail to send
replies as the branded address. Gmail "Send mail as" is a separate optional setup,
not included here. Normal replies sent from Gmail may reveal the Gmail address.

## Verification

- `pnpm lint`, `pnpm test`, `pnpm build`.
- `pnpm test:integration` against **isolated localhost Postgres** only: platform
  round-trips, expiry boundaries, concurrent expiry, session ownership/revocation,
  role-specific deadlines, service-only permissions, restrictive RLS and public access.
- `pnpm test:ui`: catalog options, expiry warnings/lock/resume and MFA routing/screens
  using fixtures. These mocks do not certify real SMTP, TOTP delivery or hosted cutover.
  If the bundled browser is unavailable on Windows, set `PLAYWRIGHT_CHANNEL=chrome`
  to use installed Chrome, or install Playwright's Chromium with its supported installer.
- Regenerate favicon assets from the supplied bee artwork with
  `node scripts/generate-app-icons.mjs`; original logos/photos are untouched.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
