---
name: Beem Hive
description: NFC-powered digital profiles — tap to connect, instantly.
colors:
  amber-signal: "#f59e0b"
  amber-deep: "#d97706"
  amber-glow: "#fbbf24"
  amber-muted: "#fef3c7"
  charcoal: "#111827"
  charcoal-mid: "#374151"
  charcoal-soft: "#6b7280"
  surface: "#fafafa"
  surface-raised: "#ffffff"
  surface-sunken: "#f3f4f6"
  border-subtle: "#e5e7eb"
  error: "#e11d48"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.amber-deep}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-destructive:
    backgroundColor: "#e11d48"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal-mid}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  input-default:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  card-default:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Beem Hive

## 1. Overview

**Creative North Star: "The Field Operator"**

Beem Hive is a tool for people who move. The admin processes orders and manages customers without ceremony. The customer builds a profile they hand out at conferences, client meetings, first introductions. The interface should operate with the same quiet confidence as the physical card itself: professional, immediate, no friction.

The palette comes directly from the logo — amber, charcoal, white. Three values. No additional hues are introduced unless a function demands it (red for errors, a secondary tonal difference for data viz). Amber carries intentional weight: it is the bee's color, the Hive in the wordmark, and the reason someone reaches for this product over a plain QR sticker. When amber appears on screen, it means something is primary, active, or worth attention. This is not decoration; it is signal.

The system rejects the interchangeable SaaS dashboard aesthetic (blue primary, identical stat cards, no personality), the link-in-bio kitsch of Linktree and its clones, the density and grey monotony of enterprise software, and the gratuitous gradient-and-blob exuberance of startup-y tools. The visual language is restrained, not colorless; professional, not corporate; confident, not loud.

**Key Characteristics:**
- Three-color brand identity: amber, charcoal, white. Errors use rose. No other hues.
- Flat tonal layering for depth — white cards on gray-50, dark cards on near-black. No decorative shadows.
- Single typeface (Geist) with hierarchy through weight and scale contrast only.
- Amber reserved for primary actions and live/active states. Its rarity is the point.
- The public `/t/[slug]` profile page is the product's face to the world; it should feel elevated, not like a free bio link.

## 2. Colors: The Hive Palette

Three origin values — amber from the bee, charcoal from the outline, white from the body. Everything derives from this.

### Primary

- **Amber Signal** (`#f59e0b` / `oklch(0.76 0.167 70)`): The brand amber. Primary buttons, active nav states, key status indicators, the login brand panel. Rarely used; never decorative. On white or light backgrounds only.
- **Amber Deep** (`#d97706` / `oklch(0.67 0.157 68)`): Hover and pressed state for Amber Signal. Also used for emphasis text inside amber-tinted surfaces.
- **Amber Glow** (`#fbbf24` / `oklch(0.83 0.157 76)`): Lighter amber for chart fills, iconography inside amber surfaces, the secondary wordmark "Hive" color at smaller sizes where Signal would look heavy.

### Secondary

- **Amber Muted** (`#fef3c7` / `oklch(0.96 0.05 91)`): Tinted amber background for warning banners, NFC setup instructions, cautionary states. Never for interactive surfaces.

### Neutral

- **Charcoal** (`#111827` / `oklch(0.19 0.01 264)`): Near-black with a faint blue-cool tint inherited from the logo outlines. Primary text, the sidebar background in light mode, the strongest surface in dark mode.
- **Charcoal Mid** (`#374151` / `oklch(0.33 0.015 264)`): Secondary text, icon fills, less prominent labels.
- **Charcoal Soft** (`#6b7280` / `oklch(0.52 0.011 264)`): Muted text, placeholders, meta information, table headers.
- **Surface** (`#fafafa` / `oklch(0.98 0 0)`): Main content area background. Off-white, not pure white.
- **Surface Raised** (`#ffffff` / `oklch(1 0 0)`): Cards, modals, table rows, inputs. One step above Surface.
- **Surface Sunken** (`#f3f4f6` / `oklch(0.96 0.004 264)`): Subtly depressed backgrounds — expanded rows, secondary panels, skeleton bases.
- **Border Subtle** (`#e5e7eb` / `oklch(0.92 0.004 264)`): Dividers, card borders, input strokes. Never decorative.

### Error / Status

- **Error** (`#e11d48`): Destructive actions, validation errors, error states. Rose family, unmistakably bad. Used only for genuine error signals.

### Named Rules

**The Three-Color Rule.** Brand amber, charcoal, and white account for all intentional color. Rose is functional (errors). Blue and purple appear only in product-type badges (Card / Stand / Round Tag) as the smallest possible scoped exception. No new hues enter the system without deliberate justification.

**The Signal Rule.** Amber Signal appears on ≤10% of any given screen in the admin and customer dashboards. Its presence means: this is the primary action or the live state. Diluting it by using it everywhere makes it mean nothing.

## 3. Typography

**Body Font:** Geist (with system-ui, sans-serif as fallback)
**Mono Font:** Geist Mono (with ui-monospace, monospace as fallback)

**Character:** Geist is a geometric sans with humanist warmth — precise enough for a professional tool, approachable enough for a customer who isn't technical. The single-family system keeps the interface cohesive; hierarchy comes entirely from weight and scale, not from a display/body split.

### Hierarchy

- **Display** (700, 2rem, 1.15 lh, -0.02em tracking): Page-level headers on the public profile. Not used in the admin or customer dashboards.
- **Headline** (600, 1.25rem, 1.3 lh, -0.01em tracking): Section titles, dialog headers, page names in the sidebar header area.
- **Title** (600, 0.9375rem, 1.4 lh): Card titles, table column group labels, form section headers.
- **Body** (400, 0.875rem, 1.6 lh): All prose, table cell content, form input text, description paragraphs. Max line length 65–75ch.
- **Label** (500, 0.75rem, 1.4 lh, 0.01em tracking): Form labels, table headers, badge text, stat card labels.
- **Mono** (400, 0.8125rem, 1.5 lh): NFC slugs, URLs, code snippets, copy-button targets.

### Named Rules

**The Weight-Contrast Rule.** Adjacent typographic elements must differ by at least one full weight step (e.g., 400 body under 600 title). A flat scale where everything is 400 medium-gray is a symptom of not trusting hierarchy. Contrast is what lets the eye navigate.

**The Mono Signal Rule.** Monospace text means "this is a machine-readable value": a slug, a URL to copy, a code snippet. Never use Geist Mono for decoration or to make something look technical.

## 4. Elevation

Beem Hive uses tonal layering exclusively in the admin and customer dashboards. Depth is expressed through stacked background values: Surface Sunken (`#f3f4f6`) → Surface (`#fafafa`) → Surface Raised (`#ffffff`). Cards sit one step above the page background; they are distinguished by the tonal step, not a shadow stroke.

Shadows are permitted only for floating UI: modals/dialogs, dropdown menus, and tooltips. These elements genuinely float above the document and need positional cues that tonal layering cannot provide. A single ambient shadow (`0 4px 24px rgba(0,0,0,0.08)`) is sufficient; heavy shadows are prohibited.

The public `/t/[slug]` profile page uses the customer-chosen gradient background. Card elements on that page may use a subtle lift shadow appropriate to the chosen theme — dark themes receive a deeper shadow, light themes a softer one.

### Named Rules

**The Flat-First Rule.** If it sits in the document flow, it is flat. Shadows are not decoration; they are a statement about position in the z-axis. Reserve them for things that are literally above.

## 5. Components

### Buttons

Tactile but contained. Buttons feel decisive without being aggressive.

- **Shape:** Gently rounded (10px radius). Not pill-shaped; not square.
- **Primary:** Amber Signal background (`#f59e0b`), Charcoal text (`#111827`), 10px/20px padding. Charcoal text on amber passes WCAG AA contrast. Weight 500.
- **Hover:** Amber Deep background (`#d97706`). No scale or translate — the color shift is enough.
- **Destructive:** Rose (`#e11d48`), white text. Used only for irreversible actions.
- **Ghost / Secondary:** Transparent background, Charcoal Mid text, 1px Border Subtle stroke on hover. For secondary actions that should not compete with the primary.
- **Disabled:** 50% opacity on any variant. Do not change the color family; just reduce presence.
- **Focus:** 2px offset ring in Amber Signal. Visible and on-brand.

### Cards / Containers

- **Corner Style:** 12px radius (rounded-xl).
- **Background:** Surface Raised (`#ffffff`) in light mode; Charcoal (`#111827`) in dark.
- **Shadow Strategy:** None for document cards. Floating cards (modal, sheet) use a single ambient shadow.
- **Border:** Border Subtle (`#e5e7eb`) in light mode; `oklch(1 0 0 / 10%)` in dark mode. 1px, never colored.
- **Internal Padding:** 24px (`spacing.lg`) standard. Compact tables may use 16px rows.
- **Nested cards:** Prohibited. A card within a card is always a layout failure.

### Inputs / Fields

- **Style:** Surface Raised background, Border Subtle stroke (1px), 10px radius, 10px/14px padding.
- **Focus:** 2px ring in Amber Signal at 60% opacity. The ring is visible but not aggressive.
- **Error:** Rose border (`#e11d48`), Rose text for validation message below.
- **Disabled:** Surface Sunken background, Charcoal Soft text, no border.

### Navigation (Sidebar)

- **Background:** Charcoal (`#111827`) light mode, slightly deeper in dark mode.
- **Default item:** Charcoal Soft text and icon, no background.
- **Hover:** Surface with 10% opacity overlay (subtle lightening).
- **Active:** Amber Signal background (`#f59e0b`), Charcoal text and icon. This is the only place amber appears in bulk in the navigation layer; it earns the contrast.
- **Width:** 240px expanded, 64px icon-only collapsed. Transition: ease-out-quart, 200ms.

### Badges / Status Chips

- **Active:** Amber Muted background (`#fef3c7`), Amber Deep text (`#d97706`). Compact, pill-shaped (9999px radius).
- **Invited:** Amber Muted background, lighter amber text — similar family but visually distinct from Active.
- **Product type (Card / Stand / Round Tag):** Blue, purple, and teal tints respectively. These are the three permitted exceptions to the Three-Color Rule. Each has a single light/dark pairing; no new tints.
- **Error / Inactive:** Rose-tinted background, rose text.

### NFC URL Display (Signature Component)

The NFC URL is the primary deliverable of the admin's work — when a card is created, the slug URL must be presented with unmistakable clarity. The URL renders in Geist Mono on a Surface Sunken background with a one-click copy button (icon + "Copied" confirmation). Adjacent to it: step-by-step NFC Tools instructions in an Amber Muted accordion. This component is the moment of handoff and should feel complete, not buried in a form.

## 6. Do's and Don'ts

### Do:
- **Do** use Amber Signal (`#f59e0b`) for primary buttons, active nav items, and the login brand panel. Nothing else.
- **Do** express depth through tonal layering (Surface Sunken → Surface → Surface Raised). Three steps is enough.
- **Do** lead with Charcoal text on white and white text on Charcoal. These are the two readable combinations at any size.
- **Do** render slugs, NFC URLs, and any machine-readable value in Geist Mono. The typeface signals "copy this."
- **Do** give the public `/t/[slug]` profile page its own elevated visual register. It is not the dashboard; it is the product.
- **Do** maintain weight contrast of at least one full step between adjacent typographic elements.
- **Do** size the NFC URL display as though it is the most important thing on the card-creation screen — because it is.

### Don't:
- **Don't** use a blue primary color. The generic SaaS dashboard look (blue primary, identical stat cards, no visual personality) is the primary anti-reference for this product.
- **Don't** make the public profile look like a Linktree clone — no gradient blobs, no pastel bubbles, no stacked rounded boxes with emoji icons. The profile page must feel like it belongs to a premium physical product.
- **Don't** build dense, grey, row-heavy admin tables without visual hierarchy. Every screen should have a clear focal point; not everything can be the same weight.
- **Don't** use gradients, blob shapes, or emoji-heavy copy in the dashboard. This is a professional tool, not a startup landing page.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. It reads as a design patch, not a decision.
- **Don't** use gradient text (`background-clip: text`). Never. Single solid color only; emphasis through weight or size.
- **Don't** add a second accent color because the interface "feels flat." If it feels flat, the hierarchy is wrong — fix the weight and scale, not the palette.
- **Don't** introduce new hues for decorative purposes. The Three-Color Rule holds: amber, charcoal, white. Rose for errors. Product-type badge colors only where they already exist.
- **Don't** use glassmorphism decoratively. Blurs on cards that float over backgrounds in the admin dashboard are not purposeful.
- **Don't** shadow document-flow cards. The flat surface is a feature. If it needs a shadow to look like a card, the background contrast is wrong.
