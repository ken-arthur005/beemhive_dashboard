# Product

## Register

product

## Users

**Primary:** Business owner (admin) — manages NFC items, creates customers, monitors platform-wide analytics. Uses the dashboard regularly as an operational tool. Expects clarity and efficiency over delight.

**Secondary:** Customer — sets up their digital profile once, returns occasionally to update links or check tap analytics. Less technically confident than the admin; needs clear affordances and a frictionless flow.

## Product Purpose

Beem Hive is the back-office and customer experience layer for a physical NFC card business. The admin creates and assigns NFC cards, stands, and tags; customers build the digital profile that appears when a card is tapped. Success looks like: admin spends minimal time managing orders, customers can build a compelling profile in under five minutes, and analytics give both sides useful signal about their reach.

## Brand Personality

Clean, modern, professional. Confident without being loud. The product should feel like the best tool for the job — not the flashiest.

## Anti-references

- **Generic SaaS dashboard:** The interchangeable admin-panel look — blue primary, identical stat cards, no visual personality. Avoid the default shadcn/Tailwind out-of-the-box feel.
- **Linktree / bio-link tools:** Cheap, social-media-bio aesthetic — gradients behind everything, pastel bubbles, profile-page kitsch. The public profile page should feel elevated, not like a free link-in-bio.
- **Enterprise software:** Dense, grey, corporate — rows of tables with no visual hierarchy, everything the same weight.
- **Overly playful / startup-y:** Excessive gradients, blob shapes, emoji-heavy copy. The business sells physical products to professionals.

## Design Principles

1. **Efficiency first for the admin.** The admin is the power user. Every admin screen should minimize clicks, surface the right information immediately, and get out of the way.
2. **Elevate the customer profile.** The public `/t/{slug}` page is the product's face to the world — it must feel premium enough that the customer is proud to hand out the card.
3. **Color earns its place.** Amber is the brand accent, pulled directly from the logo. Use it with intent — primary actions, active states, live status — not as decoration. When it appears, it should mean something.
4. **Trust through consistency.** Consistent spacing, type scale, and component behavior across admin and customer panels. The product should feel like one coherent system, not two bolted-together dashboards.
5. **Restraint over richness.** When in doubt, do less. A clean empty state beats a cluttered dashboard. Whitespace is not wasted space.

## Accessibility & Inclusion

Good-faith WCAG AA — sufficient contrast, keyboard-navigable interactive elements, legible text at all sizes. No stated special requirements.
