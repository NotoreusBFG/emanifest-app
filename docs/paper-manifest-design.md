# Paper Manifests (Form 8700-22) — design sketch

**Status: design only, nothing built yet.** Written 2026-09-26 from a
working session with the owner. No migration, route, wizard, or print
renderer exists for this yet — this doc is the handoff for whoever builds
it. Related: [[manifest-workflow-and-permissions]],
[[delegate-quick-sign-design]] (the electronic-only path this deliberately
forks away from), `private-notes/plan/manifest-templates-plan.md` (the RLS
/ claim-token model the new table should follow), and
`docs/emanifest-news-log.md` (the proposed EPA paper sunset that makes
this a bridge, not a dead end).

## The idea in one paragraph

A third-party broker prepares a **paper** hazardous waste manifest on a
registered printer's pre-numbered Form 8700-22 carbonless set, without
ever calling RCRAInfo. They walk the same manifest wizard we already have
for e-Manifests, but the very first step is typing in the tracking number
the provider pre-printed (9 digits + a 3-letter provider suffix, e.g.
`100047417PSC`), which creates a local, resumable draft row. From there
they assign the generator, transporter, and disposal facility, add waste
lines (manually, from an MM Profile, or from a Lab Pack Packing Slip),
attach LDR data, and print an overlay that fills the blank regions of the
physical form in one pass through the carbonless set. Paper manifests and
e-Manifests live in separate data stores but show up in one shipment list,
distinguished by the MTN suffix and a badge. The whole feature is
deliberately simple paperwork prep: no signatures, no certification, no
EPA submission, no regulatory clock — the generator and broker are
responsible for the paper form, exactly as they would be with a
spreadsheet.

## Why this exists now (commercial framing)

- Electronic Manifest adoption is still under ~1% of US hazardous waste
  shipments, and the **paper** path is how the overwhelming majority of
  manifests physically get created today. A tool that only speaks
  RCRAInfo is a tool that only serves the smallest slice of the market.
- Third-party brokers are exactly the users who can be handed a
  pre-printed paper form by a TSDF/registered printer and asked to "fill
  this out." Right now that user has no path through ManifestMate at all.
- EPA's proposed **Paper Manifest Sunset Rule** (published 2026-03-05,
  docket `EPA-HQ-OLEM-2025-3456`, would ban paper manifests 24 months
  after finalization) is the reason this is a *bridge*: the branch is
  designed to be cheap to retire — see "Sunset posture" below.

## The fork (the single most important architectural decision)

**Branch at the route/wizard level, before any RCRAInfo call.**

- **Electronic branch** (existing): `/manifests/new` and
  `/manifests/new/wizard`. Terminal action calls
  `saveManifest` → RCRAInfo assigns the MTN → `signManifest`.
  The MTN is an *output* of the final save.
- **Paper branch** (new): `/paper-manifests/new` and
  `/paper-manifests/new/wizard`. Terminal action writes **only** to a new
  local `paper_manifests` table. Zero RCRAInfo calls anywhere in the
  branch. The MTN is an *input* the user types in step 1.

Two facts that make the fork clean (both verified against the code):

- In the electronic path, `POST /emanifest/manifest/save` in
  `src/lib/rcrainfo/client.ts:241` is where the MTN is actually assigned —
  `ManifestOperationResult.manifestTrackingNumber` comes back from *save*,
  and signing is a separate call (`client.ts:363`). `NotAssigned` in
  `NewManifestInput` is a request placeholder, not an EPA status
  (`src/lib/rcrainfo/types.ts:388-423`).
- The paper branch never reaches that call, so the two MTN flows never
  collide. A paper provider MTN must **never** be written into
  `manifests.epa_mtn` (that column is `not null unique` and is EPA's
  real registry). The two MTNs are irreconcilable numbers from two
  different systems, and 40 CFR 262.21(f)(2) is explicit that a
  pre-printed tracking number cannot be changed.

## Data model — `paper_manifests`

One row per paper manifest, owned by the user who created it (`user_id`,
RLS-scoped exactly like the rest of this project). Deliberately *not*
`paper_shipments`, and deliberately separate from `manifests`.

Sketched columns (final names settled at build time):

- `id uuid pk`
- `user_id uuid not null references auth.users`
- `provider_mtn text not null` — the 9+3 number the user typed in.
  Unique constraint so a re-used MTN is a hard error, not a silent
  duplicate. (Scope of the uniqueness — per user vs. global — should be
  made explicit at build time; per-user is the conservative default.)
- `status text not null default 'draft'` — `draft` → `finalized` only.
  Keep it this simple (see "Dates, status, and what we deliberately
  don't model").
- `shipment_date date null` — user-entered, tracking only.
- `printed_at timestamptz null` — set when the user actually prints;
  useful audit, not a compliance date.
- Generator snapshot (per-manifest, authoritative): name, EPA ID,
  mailing address, site address, phone.
- Transporter snapshot: name, EPA ID, address/phone as entered.
- Disposal facility snapshot: name, EPA ID, address/phone as entered.
- Waste lines: either a child table or a jsonb array — the electronic
  path's waste-line shape is already the right one; see "Waste lines"
  below. A lab-pack-sourced line also records the `lab_pack_id` so the
  write-back can target the paper MTN instead of `epa_mtn`.
- LDR reference (nullable FK to the existing LDR notice row, if the
  third-party LDR path is reused as-is).
- `created_at` / `updated_at`.

**Generator storage:** the authoritative copy of generator details lives
*on the manifest row* — a manifest is a legal snapshot of a shipment on a
given day, and reusing today's managed-site data for a past paper
manifest is subtly wrong. Optionally, the paper wizard can offer to
"remember this generator" by inserting into the existing
`generator_managed_sites` table (self-attested, per-user RLS) purely as a
convenience for future manifests; that table has no mailing address or
phone, so the manifest snapshot remains the source of truth. Do **not**
build a new off-CDX generator table, and do **not** use
`third_party_customers` (it requires a generator email approval, which
the paper flow explicitly does not need).

## The paper wizard (MTN-first, save-for-later)

The existing `/manifests/new/wizard` is four modal steps (Generator,
Transporter, Facility, WasteLine) plus a review/save page, but its
intermediate state lives entirely in client `useState`
(`src/app/manifests/new/wizard/page.tsx:69-114`) and is only written on
final save — so **it cannot save for later**, which the paper flow
requires. (For the electronic flow that's arguably fine; RCRAInfo
assigns the MTN at save, so there's nothing to resume *to* yet.)

The paper wizard fixes that by inverting the order: **the tracking number
comes first.**

1. **MTN step** — user types the pre-printed `100047417PSC`-style number.
   Validated against `^(\d{9})\s?([A-Z]{3})$`, checked for duplicates, and
   the `paper_manifests` row is created immediately. This is the moment
   the manifest "exists" and the user can walk away and come back — every
   later step is a server action that updates the row.
2. **Generator** — same site search as the electronic path when RCRAInfo
   credentials are available, with a manual fallback for off-CDX
   generators (the existing `GeneratorStepModal` already has a partial
   manual path; it needs mailing address and phone added). No EPA ID
   verification against EPA — accuracy is the user's legal responsibility.
   (Do not gate on consent, and do not require a CDX account.)
3. **Transporter** — reuse `TransporterStepModal` / registry
   `handlers` as-is.
4. **Disposal facility** — reuse `FacilityStepModal` (RCRAInfo site
   search) with the same manual fallback.
5. **Waste lines** — three sources, see below.
6. **LDR** — optional, see below.
7. **Print** — the overlay plus the auxiliary documents, see below.

**Build approach: copy the orchestration, share everything else.** The
electronic wizard and its modals are a working, live path — don't refactor
them into a shared abstract wizard as part of this feature. The cleanest
diff is:

- **New**: `src/app/paper-manifests/wizard/page.tsx` (a copy of the
  wizard page with an MTN-first step and per-step server persistence),
  `src/app/paper-manifests/wizard/MtnStepModal.tsx`,
  `src/app/paper-manifests/page.tsx` (the list/lookup page),
  `src/app/actions/paperManifestActions.ts`,
  `supabase/migrations/2026XXXX_create_paper_manifests.sql`.
- **Modified (minimally)**: the existing
  `src/app/manifests/new/page.tsx` and the electronic wizard page — only
  to pass a terminal action prop (~10 lines) so the review page's
  "Create manifest" button can be pointed at either branch. No behavior
  change for the electronic path.
- **Reused unchanged**: `WizardModalShell`, `TransporterStepModal`,
  `FacilityStepModal`, `WasteLineStepModal`, `ManifestFieldsForm`, and
  the profile / lab-pack pickers.

## One list, two lifecycles

Paper and e-Manifests show up in the **same shipment list** (dashboard and
`/manifests`-style views), because a broker's day is a mixed list. They
are distinguished by:

- the MTN suffix (paper suffixes come from EPA's approved-printer
  registry; e-Manifest suffixes may not be in it),
- a Paper / e-Manifest badge,
- completely separate lifecycle behavior: electronic goes
  Saved → Shipped → Received → Certified (EPA-driven); paper goes
  draft → finalized (user-driven, no EPA state at all).

**Suffix classification** is a convenience, not proof — EPA's registry
has real collisions (more than one listed registrant has used `NNI`).
Classify a known paper suffix as paper; if the suffix is unknown, ask the
user ("is this a paper manifest from a registered printer?") rather than
guessing. The registry is at
`https://www.epa.gov/hwgenerators/approved-registered-printers-epas-manifest-registry`
and should be refreshable data (not a hardcoded `switch`) so a new
registrant doesn't require a code change. Suffixes seen in the current
registry: `JJK`, `FLE`, `WAS`, `GRR`, `GBF`, `VES`, `SKS`, `CLE`, `PSC`,
`DAT` (Clean Earth currently uses `CLE` *and* `PSC`).

## Waste lines — three sources

1. **Manual** — the existing waste-line entry fieldset.
2. **MM Profile** — the existing waste-profile picker (the electronic
   wizard already loads profiles).
3. **Lab Pack Packing Slip** — select a finalized lab pack and it
   contributes one manifest waste line. The mapping is already
   manifest-shaped (`supabase/migrations/2026092201_create_lab_packs.sql`):

   | Manifest item | Lab pack field |
   | --- | --- |
   | 5 (generator) | `generator_epa_id` / `generator_name` / `generator_address` |
   | 9a (non-hazardous?) | `is_non_hazardous` |
   | 9b (DOT description / codes) | `dot_shipping_description`, `rq_indicator`, `rq_codes` |
   | 10 (container type/size) | `outer_container_type_code` / `outer_container_size` |
   | 11 (quantity) | `total_weight` — **nullable**; print blank, user fills in by hand if the drum is weighed after the fact |
   | 13 (waste codes) | `waste_codes` |

   Only `finalized` packs feed a printable manifest. On save, the paper
   flow writes the `provider_mtn` + line number back to the lab pack —
   note that today's `linkLabPackToManifestLine`
   (`src/services/labPackRepository.ts:283-307`) writes `epa_mtn`, so it
   needs either a paper variant or an extra link column.

## LDR

Include it. The existing third-party LDR path
(`/ldr/new/third-party`, `src/lib/ldr/types.ts`) already produces the
notice text; the paper flow reuses it and hangs it off the manifest row.

The one real design problem is **Item 14 contention**: Item 14
("Special handling instructions / Additional information block") is
already crowded by three things that all want to live there —

1. the composer's `handlingInstructions` (4,000-char cap),
2. the agency-authority sentence that may already be pre-printed on the
   physical form (`AGENCY_AUTHORITY_ITEM_14_TEXT`,
   `src/lib/rcrainfo/certificationText.ts:59-71`),
3. the LDR-required information,
4. the MTN verification note (see "What gets printed where").

**Placement decision: the MTN verification note goes in Item 14**, based
on Item 14's own instruction (special handling instructions **or**
additional information, e.g. shipment-specific tracking information),
*not* based on the rejected-load MTN quote in the instructions (that's a
narrow case where EPA lets a rejected load reuse an MTN — bad reasoning to
borrow). It goes in Item 14 specifically so it can't be mistaken for part
of the generator's certification.

**Overflow goes to continuation-sheet Item 32.** When Item 14 is full,
the LDR-required information and the MTN note are the first things to drop
or move to a continuation sheet, in that order.

## What gets printed where

**Item 4 — never touched.** It's already on the physical form; the
provider pre-printed it.

**Item 15 — not ours to fill.** It's the generator's certification, and
the signature field (`15-2_signature`) is explicitly the one thing EPA
does *not* allow to be pre-printed. The generator signs all of it by
hand. ManifestMate never writes to Item 15.

The EPA authorization for the whole approach, verbatim: *"All of the
above information except the handwritten signature required in Item 15
may be pre-printed."*

Everything else (Items 5–14, 16–32 depending on the form revision) is
filled by the overlay.

**Item 16** is probably "Date of Shipment" (its "International Shipment"
sub-field may have been folded into the "Enter Date of Shipment" line) —
**unverified against the current physical form**; see "Open questions".

## Printing — the hardest part of this feature

**The physical form is the source of truth, not EPA's web sample.** The
commonly-cited `form-2050.pdf` on EPA's site is a fillable electronic
form; the physical provider form has additional pre-printed text (the
agency-authority sentence on Item 14 is one example) that the web copy
doesn't reproduce. Deriving a layout from the web copy alone would
mis-map the pre-printed vs. blank regions.

**Overlay, not replacement.** The print output is a *frameless* dot
matrix overlay the user prints **on top of** the physical form, in one
pass through the carbonless set, so the user gets correctly interleaved
multi-part forms without any per-copy routing. (Carbonless sets, not
"Copies" printer settings — the app has no knowledge of individual sheets
and shouldn't try to manage them.)

- Committed layout: `src/lib/paperManifest/layout-8700-22.json`, derived
  by a proposed `scripts/derive-8700-22-layout.ts` from the actual form,
  then hand-augmented for pre-printed regions. The layout must record
  which regions are **pre-printed on the form** vs. **blank** vs.
  **optional (printed only if data exists)**.
- Physical `formRevision` is recorded with each layout; printing against
  a mismatched revision should fail loudly with "confirm you have the
  right form revision," not print garbage.
- Three rendering modes from the same layout: (1) a precise character
  grid for the dot-matrix overlay, (2) a monospace PDF fallback for users
  without a dot matrix printer, (3) a hand-write checklist ("write X in
  Box Y") for users printing onto a form by hand. Existing print pages
  in this repo (`src/app/bol/[id]/print/page.tsx`,
  `src/app/labels/print/page.tsx`, `src/app/ldr/[id]/PrintButton.tsx`)
  are plain `window.print()` with no shared stylesheet — the paper form
  is the first thing that needs a real print stylesheet, and it is worth
  building one properly.
- The form targets 12 cpi / "elite" pitch. Global calibration offsets
  (x, y, cpi, lpi) and tractor-feed alignment are expected to need one
  physical test pass with a real printer and the real form before this
  is trustworthy. Ship a "calibrate" affordance rather than pretending
  it's exact from day one.

**Print actions (the three buttons):**

1. **Print manifest** — the overlay (or the monospace fallback).
2. **Print packing slips, LDR notices, and the work order** — one
   "print all supporting documents" action. The work order is a
   **placeholder** for a future build (ManifestMate doesn't schedule
   pickups today).
3. **Send labels to label printer** — reuse the existing thermal
   4×6 label path (`src/app/labels/print/page.tsx`).

Plus, if useful: a plain-paper **reference copy** clearly marked
"REFERENCE COPY" that carries the provider MTN, for the user's own
records.

**A note on the electronic path's quantities:** the electronic
`form-2050_quantities_blank.pdf` is a useful precedent — quantity
fields print blank so the user can fill in weights by hand — and the
paper overlay should behave the same for Item 11 (total weight) and
Item 16 (date) when the user hasn't entered them.

## Dates, status, and what we deliberately don't model

The owner's explicit position on the "30-day clock":

- `shipment_date` is a **user-entered, optional** field for their own
  tracking. They can leave it blank. (The date the manifest is sent to
  the printer is *noted* as the manifest's creation date in our records —
  that's the `printed_at` system timestamp, not a legal date.)
- A 30-day **reminder** is derived from that date *if set* — that's it.
  No "overdue" compliance state.
- **No `delivered_at`**, no regulatory countdown, no shipped/received/
  certified lifecycle, no reprint enforcement, no "you can't reprint a
  signed form" logic. (EPA's regulatory text says the 30-day period runs
  from *delivery*; the product intentionally doesn't model that — it's a
  tracking reminder, not a compliance record, and ManifestMate never
  learns the delivery date on paper.)
- Status is `draft` → `finalized` and nothing else.

**Liability posture, stated plainly in the product copy:** ManifestMate
is a simple paperwork-prep tool. It does not sign, certify, submit, or
create legal records — the generator and the third party are responsible
for the paper form exactly as they would be filling it out in a
spreadsheet. The paper flow needs no EPA ID verification because the user
carries that responsibility.

**Sunset posture:** when the paper sunset rule (if finalized) starts its
clock, the app says so plainly in docs and points people at the
electronic wizard. There is deliberately **no in-product countdown
timer**; a neutral "how many paper manifests have you created this
month, and here's the electronic path" prompt is the most we should add.

## Access control

- The paper branch is **third-party only**, **Plus tier or above**, and
  feature-flagged (follow the existing `feature_flags` pattern; all
  current flags default OFF).
- All third-party functionality is minimum Plus going forward; Pro is for
  the AI-heavy flows (e.g. the existing Pro-gated Segregation Wizard).
  Note the electronic Manifest Wizard is currently flag-only with no tier
  floor (`src/app/actions/manifestWizardActions.ts:7`) — decide with the
  owner whether that gets a Plus floor too as part of this work.
- `src/middleware.ts` handles the route-level UX gate, but the real
  enforcement must be in the paper server actions and the `paper_manifests`
  RLS policies (deny-all default, per-user `select`/`insert`/`update`) —
  same pattern as every other user-scoped table here, and the same
  security model as `private-notes/plan/manifest-templates-plan.md` minus
  the consent/claim-token machinery (paper manifests don't need a
  generator-approval step).

## Wizard viability — why this is mostly reuse, not a rewrite

Confirmed against the existing code: the electronic wizard's four modal
steps, the shared `ManifestFieldsForm` (1,369 lines), the profile picker,
and the lab-pack "unlinked" filter (`!p.epa_mtn`) all exist and work
today. The paper wizard's *only* genuinely new code is the MTN-first
persistence model. Copy the orchestration; share the forms.

## Open questions / verification needed before build

These are real gaps in the research, not oversights — each needs a
physical form or a live EPA/RCRAInfo check that wasn't possible from the
code alone:

1. **Copy count and current form revision.** EPA's own sources conflict:
   the FAQ says a 4-copy form (Page 3 removed) took effect 2025-01-22,
   while another EPA page and the `DataImage5Copy` API name indicate a
   5-copy form. The widely-cited instructions PDF is "Revision 12-17"
   from 2020 (5-copy era). **Get the actual form from a registered
   printer and read it.** The overlay design is copy-count-agnostic (one
   pass through the carbonless set either way), but the layout map and
   the Item 16/32 fields depend on it.
2. **Item 16's exact current layout** (date vs. international-shipment
   sub-field) — verify on the physical form.
3. **Item 14's pre-printed regions on the real form** — the agency
   authority sentence, and whether Item 32 continuation sheets are
   pre-printed headers or blank.
4. **Physical printer calibration** — 12 cpi offset, tractor alignment,
   one full test pass with the real form.
5. **Whether the physical form is even 12 cpi** in practice (the
   instructions say 12; verify against the stock the user's printers
   actually use).

## Explicitly out of scope for v1

- **Hybrid signing** (some signatures electronic, some on paper) — the
  full-paper-only model is simpler and matches how brokers actually work
  today. Revisit only if a real customer asks.
- **Any ManifestMate submission of the paper manifest to EPA.** The
  TSDF uploads the scanned paper copy (EPA's "Upload Paper Manifest" UI
  wants a 300 DPI B&W PDF); ManifestMate has no API for this and doesn't
  try to be one. The `Image`/`DataImage5Copy` types in
  `src/lib/rcrainfo/types.ts` relate to TSDF-uploaded scanned images
  (per-site authorization), not to a paper-manifest creation API.
- **The "did the TSDF receive it?" check.** A future
  `getManifest(provider_mtn)` is plausible (`ReadyForSignature` exists
  in `ManifestStatus`), but it requires third-party RCRAInfo credentials
  and a real uploaded paper manifest to be meaningful — verify later,
  don't block on it.
- **Automatic weight capture / scale integration.**
- **Per-copy routing or "Copy 1/2/3" management** — the carbonless set
  handles interleaving; the app doesn't manage individual sheets.
