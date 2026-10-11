# Beem Hive — Honey & Ink

Approved visual direction: 2026-10-11. This replaces the earlier Field Operator design language.

## Purpose and audience

Beem Hive connects a premium physical NFC product with a professional digital identity. The owner manages items and customers; customers build, publish and share their identity; visitors tap an item to connect. Operational clarity and a memorable customer experience both matter.

## References and composition

- `public/inspo2.jpg`: warm light surfaces, generous corners, integrated top navigation, confident typography, asymmetrical dashboard composition.
- `public/inspo1.jpg`: dimensional card stacks, selective translucency, richer dark surfaces, sophisticated depth.
- Keep the existing Beem Hive bee and wordmark. The interface should feel bespoke to the physical NFC product.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#ecebe4` | `#101510` |
| Dashboard shell | `#f6f5ef` | `#181e18` |
| Panel | `#fdfcf8` | `#202620` |
| Text | `#242820` | `#f5f3e9` |
| Muted text | `#737269` | `#aaa99d` |
| Honey action | `#f3c442` | `#f3c442` |
| Action text | `#292718` | `#292718` |
| Border | `#e3e1d7` | `#ffffff13` |
| Admin sidebar | `#f9f8f3` | `#1b211b` |

Warm gray/amber Tailwind ramps and semantic variables are defined in `src/app/makeover.css`. `src/app/globals.css` maps them to component-library tokens. Public profiles use independent foreground/surface variables derived from the customer's selected background.

Honey may anchor the identity panel and authentication composition. Use green-toned ink, brass and pale olive as material colors for the NFC collection. Rose remains a functional error/destructive signal. Avoid generic blue primaries and rainbow decorative UI.

## Typography and spacing

- **Manrope:** headings, brand text, prominent numbers. Page headings 28–42px; sign-in editorial heading up to 64px; section titles 18px.
- **DM Sans:** readable 13–14px interface text, forms and tables.
- **Geist Mono:** machine-readable URLs and slugs only.
- Clear contrast in scale and weight; warm, readable secondary text. No gradient text.
- Dashboard shell radius 32px, panels 24px, fields 12px, actions pill-shaped.
- Responsive content padding 20–44px; panel padding 20–30px; purposeful differences between related groups and major sections.
- Light navigation stays light. Dark mode is a designed material palette, not an inverted light screen.

## Navigation and screens

Customers use top navigation: Overview, My Profile, My Cards, Analytics. A compact dialog navigation adapts the experience to phones with keyboard focus management. Account controls provide profile access and sign out. Admin uses an expandable, theme-matched sidebar and a compact workspace header.

The Overview leads with digital identity, then real tap performance, the NFC collection, and contextual next steps. Respect publication state: the published identity reflects the public snapshot, while editor previews reflect the private draft.

Publication history determines default landing: My Profile before the first publication; Overview afterward, including after unpublishing. Explicit safe dashboard destinations take precedence. Revision zero is a valid publication. Loading and failed history reads must never silently invent an onboarding state.

Public profiles use arched portraits, editorial identity typography, divided link rows and a clear Save Contact action. Public rendering and draft previews share `profile-presentation.js`; preview contact downloads are disabled. Preserve protected photo handling, valid link destinations, customer-selected backgrounds and analytics ownership.

## Motion and materials

- Sign-in: GSAP MotionPath bee flight, DrawSVG trail and signal strokes, logo reveal. Play once per browser session with an explicit replay control; provide a lightweight mobile composition.
- Dashboard: scoped page reveals, a sliding active navigation indicator, NFC stack choreography and pointer-responsive depth.
- Hover and interaction feedback: transform/opacity/color transitions with `power3.out` or `cubic-bezier(.22,1,.36,1)`.
- Use `useGSAP`, scoped refs, cleanup and reduced-motion alternatives. Charts also respect reduced motion. Motion never gates a form or button.
- Glass is selective: integrated navigation, floating overlays and theme labels. Soft ambient panel shadows and deeper physical-card shadows express intentional depth.
- Touch devices retain every action without depending on hover.

## Component sources

- Theme/layout/material rules: `src/app/makeover.css`
- Brand and cropped original bee: `src/components/shared/brand.js`
- Signature animation: `src/components/shared/bee-scene.js`
- Page choreography: `src/components/shared/page-reveal.js`
- Customer navigation: `src/components/customer/header.js`
- Product material/stack: `src/components/customer/nfc-collection.js`
- Public profile/preview: `src/components/public/profile-presentation.js`
- Shared controls: `src/components/ui/` and `src/components/admin/admin-controls.js`

## Anti-patterns

- Decorative symbols or sparkles floating inside pastel rounded-square tiles.
- Invented metrics, decorative charts, made-up activity or fake product assignments.
- Identical icon/number cards as the entire dashboard composition.
- Excessive blur, gratuitous glow, gradient text, bouncy motion, hover-only functionality.
- Collapsing private-draft and published-snapshot states into a vague “saved” indicator.
- A dark sidebar on a light dashboard.

## Verification

Lint, production build, unit tests, and browser UI checks cover publishing, admin operations, publication-aware landing, explicit deep links, mobile navigation/focus, theme persistence, reduced-motion sign-in, public link/contact destinations and mobile overflow. Browser fixtures use sample data; shipped screens use authenticated APIs.
