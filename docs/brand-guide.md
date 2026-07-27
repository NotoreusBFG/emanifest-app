# ManifestMate — Brand & UI Reference

A practical, implementation-level brand reference for anyone (human or
agent) creating new files, pages, or assets that need to visually match
the live site. Every value below is pulled directly from the current
codebase, not approximated — file references are included so anything
here can be re-verified against the source of truth.

## What ManifestMate is

A tool that lets hazardous waste generators create, sign, and track EPA
e-Manifests (RCRAInfo) without the compliance paperwork headache, with a
guided setup path for generators new to hazardous waste manifesting.
Tone is plain and direct — practical SaaS copy, not marketing fluff.
Buttons say exactly what they do ("Sign in", "+ New manifest", "Create
account"), not clever euphemisms.

## Logo

- `public/manifestmate-logo.jpg` — the primary lockup (compass mark +
  wordmark), 615×171px source, JPEG. Used at 220×62 in the site header.
- `public/manifestmate-icon-flow.png` — a wider illustrative graphic
  (drum → transport → disposal facility flow), 1610×280px, PNG with
  transparency. Used in the homepage hero.
- The wordmark itself renders "Manifest" in dark navy and "Mate" in
  brand blue (see any `<h1>ManifestMate</h1>`-style lockup) — keep that
  two-color split when reproducing the wordmark in text form.

## Color palette

Source of truth: `src/lib/brandColors.ts` (JS/TS token export) and
`src/app/globals.css` (CSS custom properties + Tailwind `@theme` wiring,
Tailwind v4). Both must always agree — treat brandColors.ts values as
canonical if they ever drift.

| Token | Hex | Use |
|---|---|---|
| `brand.blue` | `#0058b8` | Primary actions, links, the "Mate" half of the wordmark |
| `brand.green` | `#24bc90` | Paired with blue in the primary gradient; secondary accent |
| `brand.teal` | `#28ac98` | Tertiary accent (eyebrows, small highlights) |
| `brand.navy` | `#0a2246` | Headings, body emphasis, the "Manifest" half of the wordmark |
| `brand.tint` | `#e8eef4` | Default page background site-wide (not white) |

Primary gradient (main CTA buttons):
```css
linear-gradient(to right, #0058b8, #24bc90)
```

Status badge colors (manifest lifecycle state — see `badgeColors` in
`brandColors.ts`):

| Status | Background | Text |
|---|---|---|
| Scheduled | `#e9eef4` | `#0a2246` |
| In transit | `#fdf3e3` | `#a15c00` |
| Overdue | `#fdecea` | `#c0392b` |
| Received | `#e6f8f1` | `#178a63` |
| Rejected | `#f4e3fb` | `#8a2fa1` |

**Login page only** gets its own dark treatment — a full-bleed gradient
background instead of the tint:
```css
linear-gradient(160deg, #0a2246, #0f2d59)
```

**Light-mode only, deliberately.** There is no dark-mode variant of this
palette yet — `globals.css` explicitly forces `color-scheme: light`
site-wide. Don't add a `prefers-color-scheme: dark` treatment to
anything matching this brand without designing one first; the palette
(light tints + navy text) doesn't invert safely as-is.

## Typography

- **Primary typeface: Geist** (via `next/font/google`, variable
  `--font-geist-sans`), the default for anything on Tailwind. Geist Mono
  is available as `--font-geist-mono` for anything tabular/code-like.
- **Legacy fallback stack:** a handful of older, not-yet-migrated pages
  still use inline styles with `Arial, Helvetica, sans-serif` — Geist is
  the target for all pages, this is being phased out, not a second
  intentional typeface.
- No serif anywhere in the product UI. (A serif was used deliberately in
  one internal *reference document* artifact for a different, editorial
  purpose — that's not part of this brand.)
- Headings: bold, `brand.navy`. Body copy: `gray-600`/`gray-700`.
  Secondary/meta text: `gray-400`/`gray-500`.

## Shared UI components

Canonical implementations: `src/components/ui/` (`Button.tsx`,
`Input.tsx`, `Card.tsx`, `Badge.tsx`). Reproduce these exact shapes
rather than inventing new ones.

**Button** — pill-shaped (`rounded-full`), two variants:
- Primary: white text, the blue→green gradient fill, `hover:opacity-90`
- Secondary: `border-2 border-brand-blue`, blue text, `hover:bg-brand-tint`
- Padding `px-6 py-3`, bold weight, disabled state is `opacity-60` +
  `cursor-not-allowed`

**Card** — the base surface for all content (replacing bare backgrounds):
- White background, `rounded-xl` (10–12px)
- Soft shadow: `box-shadow: 0 2px 10px rgba(10,34,70,0.06)`
- (A 1px `#e3e8ee` border is used instead of shadow only where rows are
  dense, e.g. tightly stacked list rows.)

**Input** — single-line text/password style:
- `rounded-md`, `border border-gray-300`
- Focus state: blue border + a matching 1px blue ring
- Optional label above (small, medium-weight, navy) and hint text below
  (small, gray-500)

**Badge** — pill-shaped status label (`rounded-full`, small `px-3 py-1`
text), colored per the status table above — bold, small, uppercase-free
(sentence case, e.g. "In transit" not "IN TRANSIT").

## Layout conventions

- Default page background is `brand.tint` (`#e8eef4`), with white
  `Card`s floating on top for contrast — never bare white as the page
  background.
- Content is a centered column (`mx-auto`, typical `max-w-xl` to
  `max-w-4xl` depending on the page), not full-width.
- Sticky header: logo (left) + horizontal nav links (center/right,
  `text-brand-navy`, `hover:text-brand-blue`) + auth state (right).
  Two soft decorative blurred gradient blobs (blue→green,
  green→teal, ~20%/10% opacity) sit fixed in opposite corners of the
  viewport, behind all content — a subtle ambient touch, not a strong
  visual element.
- Border radius scale: `rounded-full` for buttons/badges/pills,
  `rounded-xl` (10–12px) for cards, `rounded-md` for inputs — nothing
  sharp-cornered, nothing more rounded than a pill.

## What NOT to introduce

- New accent colors outside the palette above.
- A serif typeface, or any typeface other than Geist, anywhere in the
  actual product UI.
- Dark mode, unless explicitly asked to design one.
- Sharp (non-rounded) corners, or heavier/harsher drop shadows than the
  soft card shadow specified above.
- Emoji as icons in newly-built UI (older pages still have some, e.g.
  🖨️/📋 as inline action icons — being phased out, not the target style).
