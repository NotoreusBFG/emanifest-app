# Haz Waste University — design & status

**Status: V1 built 2026-07-27, not yet live-tested in a browser.** A new
public (no login required, same as `/faq`) educational section — deeper
dives into RCRA, DOT, and hazardous waste management, cross-linked from
the actual tools (LDR notice form, manifest creation form) so users get
context right where they need it.

## Source material reviewed to build this

The user dropped four files in `docs/` for this session:

1. **`LDR Ref from Utah`** (PDF, 14 pages) — a Utah DEQ training deck,
   "Working with Your Transporter: Manifests and LDRs." Covers the
   manifest-as-DOT-shipping-paper framing, exception report timing
   (35/45 days), and — critically — includes **two real, filled-out LDR
   Notification Form examples** (pages 11-12) showing actual field
   structure: a "LDR Chemical Data" table with THREE separate Y/N flags
   per constituent (Underlying Hazardous Constituents / Constituents of
   Concern / Contaminants Subject to Treatment — more granular than our
   current single free-text field), a hazardous-debris section with three
   named sub-checkboxes, the soil (DOES/DOES NOT) certification language,
   and confirmation that our lab-pack (letter E) certification text
   matches real-world forms almost verbatim.
2. **`#3+US+Ecology_Steve+Gryniewicz+&+Addie+Burden.pdf`** (59 pages) — a
   conference presentation from US Ecology (a real TSDF operator) titled
   "Land Disposal Restrictions." Gave the clearest plain-English framing
   of the three treatment-standard types (TCLP/waste-extract, totals,
   technology) and included their own internal LDR intake form, which
   independently confirms the wastewater/nonwastewater threshold
   (<1% TSS & TOC) and the "one-time vs. every-shipment" notice framing.
3. **`Waste-Characterization-Reference-Book-ch4.pdf`** (28 pages) — **this
   one is gold**: scanned pages directly from the actual published CFR
   volume (40 CFR Ch. I, 7-1-13 Edition), not a summary or compilation.
   Cross-checked several entries (D004 Arsenic, D008 Lead, D018 Benzene)
   against `src/lib/treatmentStandards.ts` (built earlier this session
   from a Cornell LII fetch) — they match exactly, independently
   confirming that data is accurate. Also covers F/K/P/U-listed treatment
   standards (sampled F006-F008), which is genuinely new — the app's
   scope so far has deliberately stayed D001-D043 only.
4. **`Manifest Utah.html`** — turned out to be an empty Laserfiche
   "Download" redirect stub, not real content (it just auto-redirects to
   a Utah state document portal URL). No usable content; flagging so it's
   not mistaken for a reviewed source later.

None of these were reproduced verbatim in the site content — they're
someone else's authored presentations, not regulatory text. Every article
below is written fresh, in ManifestMate's own words, citing the actual
CFR sections as the authoritative source.

## What was built

- `src/app/university/ArticleLayout.tsx` — shared shell (hero, article
  body, sources footer) matching the FAQ page's Tailwind-based public
  page pattern, not the plain-inline-style pattern used for in-app tool
  pages.
- `/university` — index page linking to each topic.
- Four articles: `/university/rcra-basics`, `/university/manifests-and-dot`,
  `/university/waste-determination`, `/university/land-disposal-restrictions`.
- Nav link added to both signed-in and anonymous header nav (same
  placement logic as FAQ) — not added to `middleware.ts`'s protected
  paths, since this is public content like FAQ, not a user-data page.
- Cross-links added FROM the product back INTO this content: the LDR
  create form (`/ldr/new`) and list page (`/ldr`) both link to the LDR
  article; the manifest creation form's federal-waste-code field links to
  the waste-determination article.

## Not done yet / open follow-ups

- Only 4 topics exist. Natural candidates for more: DOT hazmat shipping
  specifics (proper shipping names, hazard classes, placarding), EPA
  registration/RCRAInfo access (could reuse the onboarding-wizard
  research already done this session), generator categories in more
  depth, biennial reporting.
- The three-Y/N-flag "LDR Chemical Data" structure found in the Utah
  deck's real form example is more granular than ManifestMate's current
  single free-text "constituents of concern" field — worth considering
  as a future LDR form enhancement, not done here.
- The Waste Characterization Reference Book's F/K/P/U treatment-standard
  content (confirmed present, only lightly sampled) could extend
  `treatmentStandards.ts` beyond D001-D043 if that scope ever gets
  revisited — flagged, not built.
- Typechecked and route-smoke-tested (all five new routes return 200) but
  not yet reviewed in an actual browser.
