# Dependency and application security status

## Patched application dependencies

Next.js is pinned to 16.3.6 and React/React DOM to 19.2.8. The outdated shadcn
generator was removed from application dependencies; its MIT-licensed compatibility
CSS is retained locally. Sharp is deduplicated at 0.35.5. Patched transitive versions
are enforced in pnpm-workspace.yaml, including PostCSS, source maps, browser mapping,
and development lint dependencies.

The production dependency audit reports no known vulnerabilities. CI runs the
production audit alongside lint, unit, database, browser and build checks.

## Remaining upstream development-tool advisory

`braces@3.0.3` remains under `eslint-config-next → @next/eslint-plugin-next →
fast-glob → micromatch`. Its latest published version has an unpatched high-severity
deep-pattern stack-exhaustion advisory:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

It is a development lint dependency, absent from the production dependency tree.
Lint repository-controlled patterns only; do not expose lint/glob tooling to
untrusted HTTP inputs. Track the upstream fix rather than claiming the full
development audit is clean or installing an invented patched version.

## Server boundaries and release verification

Privileged clients are server-only, isolated from user cookies and guarded by
verified identity, exact roles, active account state and same-origin mutation checks.
Lifecycle/setup/publication RPCs are service-only and tested against Postgres RLS.
Private photo versions and immutable publication snapshots share public eligibility
with profiles and contacts. Public responses use no-store caching.

Real Auth/SMTP/Storage configuration, hosted deployment and physical-device imports
still require the coordinated verification in DEPLOYMENT.md. These checks must not
be represented as completed by mocked browser tests or local database stubs.
