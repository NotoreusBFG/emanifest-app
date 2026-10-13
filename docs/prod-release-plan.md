# Production release plan: `dev` → `main` (www.hazwastemanifestmate.com)

Written 2026-10-13. **Living document**: re-evaluate before any release step (see "Re-evaluation protocol").

## Baseline (what this plan was written against)

| Item | Value |
|---|---|
| `origin/main` tip | `cba8cb8` (serving production now: `emanifest-gmyhtc1bb`) |
| `origin/dev` tip | `9e8dfaa` |
| `dev` commits not on `main` | 76 (2026-08-31 → 2026-10-05) |
| `main` commits not on `dev` | 3 (security headers x2, news log) |
| Diff size | 183 files, +41,852 / −622 (≈19k lines are `docs/erg-guide-numbers.json`) |
| Prod DB | `kbevffgffynemttuqcfh`, 53 migrations applied, latest `20260907`, **identical to `main`'s files** |
| Sandbox DB | `fjyqhbnmfhlryehmeiyb` (backs `dev.`), has all 85 migrations |
| Dev-only migrations | 32 (`20260908` … `2026092602`), none on prod. `supabase db push --dry-run` on prod lists exactly these 32, nothing else |
| Merge conflicts | One: `next.config.ts` (both sides edited the security-headers block) |

Context: on 2026-10-12 production was found serving a `dev` build (Vercel source mis-set), then rolled back to `main`. That build
ran against a DB lacking these 32 migrations, which is the failure this plan is built to prevent: **code must never go live
before its schema.**

## Verdict: a phased release is warranted

Not by splitting the code (76 commits are intertwined with the migrations and cherry-picking would be riskier than the merge),
but by splitting the **release into ordered phases**: schema first, then code, then feature exposure.

Reasons:
1. **Schema and code are tightly coupled.** `src/lib/supabase/middleware.ts` (runs on every protected request) reads profile
   state introduced by migrations (`rejected_at`, account type/approval gate). Dev code against the current prod schema is the
   10-12 incident. The reverse (old `main` code against the new schema) is believed safe (see Phase 1) but must be proven.
2. **The migrations are additive and mostly idempotent, so they can be applied early and independently.** That lets us
   de-risk the DB while prod still serves known-good `main` code, and Vercel instant-rollback stays a clean undo for code.
3. **Most new surface is flag- or tier-gated and default-off**, so exposure can be staged per feature/account after the code
   is live, rather than all at once.
4. **Some changes are NOT gated** and alter existing behaviour for current users (list below). They get explicit smoke tests.

## What changes in production (grouped)

**Gated, default off (flags inserted `enabled=false`, tier default `free`):**
`manifestmate_wizard_generator`, `manifestmate_wizard_third_party` (Profile Wizard, AI, tier `plus`),
`manifestmate_labpack_wizard_generator` (Segregation Wizard, AI, tier `pro`), `manifest_wizard` (no AI, flag only).

**Ungated: appears for all users on deploy:**
- Waste profiles library, container labels with QR, generator label printing, Bill of Lading (`/bol`), lab packs and lab
  pack jobs, chemical library (PubChem lookups), custom waste codes, ERG numbers, training page, `/scan` page.
- Team / multi-seat accounts, third-party customers, admin roles (`grant_admin`/`revoke_admin`/`list_admins`),
  reject action for signups, admin "switch my account type" (`set_my_account_type`, admin-only).
- "Text to scan" invites and the waste-line-edit delegate flow (`create_waste_line_edit_token` etc. rebuilt).

**Existing-behaviour changes (highest regression risk):**
- `src/lib/supabase/middleware.ts`: approval gate now also handles rejected accounts; transporter/disposal accounts are
  redirected away from `/manifests/new`, `/ldr/new`, `/bol/new`; `/bol` and `/scan` added to protected paths.
- `src/app/ldr/new/prepared/page.tsx` (+432/−328), `ldr/new/third-party`, `manifests/new/ManifestFieldsForm.tsx`,
  `settings/page.tsx` (+531), `manifestRepository.ts` (manifest facility/generator now read from local mirror, not live EPA).
- `list_pending_profiles` fixed and reshaped; `approve_profile` rewritten (clears `rejected_at`).
- `next.config.ts` headers: dev changed `connect-src` (adds RCRAInfo hosts, **drops the Vercel Blob host**). CSP is report-only
  so it cannot block, but merge the union so reports stay clean.

## Pre-flight (do all before Phase 1)

1. **Backup:** confirm Supabase prod has PITR or take a manual backup; note the restore point. *(Not verified: no
   dashboard access from here.)*
2. **Resolve the `next.config.ts` conflict** on a merge branch (`release/dev-to-main`), not on `main`. Keep CSP report-only; keep
   `connect-src` = union of both sides; keep the higher `SECURITY_HEADERS_VERSION` and run
   `riverlock/tools/check-security-headers.sh` (drift guard named in the file).
3. **Build the merge branch:** `npm ci && npm run build && npm run lint`. *(Not run yet.)*
4. **Env vars:** production lacks `AI_GATEWAY_API_KEY` (only in local `.env.local`). Needed only for the two AI wizards
   (`src/lib/ai/wizardExtraction.ts`). Add it to Vercel *production* before enabling those flags, not before deploy.
   Everything else dev code references is already set.
5. **Careful: Vercel Preview shares the prod DB.** `NEXT_PUBLIC_SUPABASE_URL` is set for both Production and Preview on
   `emanifest-app`. A preview of the merge branch hits **production data**. Do not click through destructive flows on it; or
   scope a preview-only env to the sandbox first.
6. **Vercel source check:** project `emanifest-app` → Settings → Git → production branch must be `main`
   (verified via API on 2026-10-13). Re-check immediately before merging. This is the setting that caused the 10-12 incident.
7. **Review the larger migrations by hand** (a pattern scan found no `truncate`, no table/column drops, no type changes, but it
   was not a full read): `20260921_create_waste_profile_documents`, `2026092201_create_lab_packs`,
   `2026092206_waste_line_edit_delegate_data_access`, `2026092208_add_via_to_waste_line_edit_tokens`.
8. **Fix the ordering gotcha:** see `.claude/skills/apply-migration/SKILL.md` (same-day filename collisions, feature_flags
   ordering). Dry-run must still list exactly the expected set.

## Phase 1: Schema only (prod keeps serving `main`)

Goal: bring the prod DB to dev's schema while production still runs the known-good `main` build.

1. Re-link CLI to prod: `npx supabase link --project-ref kbevffgffynemttuqcfh`; `npx supabase db push --dry-run`;
   confirm the list equals the 32 migrations (or the current expected set).
2. `npx supabase db push`. **Re-link back to sandbox afterwards** (`fjyqhbnmfhlryehmeiyb`).
3. Verify: `npx supabase migration list --linked` shows no gaps vs files; the four flags exist with `enabled=false`;
   `profiles.tier` defaults to `free`, `profiles.rejected_at` exists.
4. **Smoke test old code against new schema** (this is the backward-compat proof). On `hazwastemanifestmate.com` as an
   existing approved generator: sign in, dashboard, manifest list, open a manifest, create a waste-line-edit link and open it
   (exercises the rebuilt `create_waste_line_edit_token` / `get_waste_line_edit_session`; `main` calls the 7-arg form and the new
   function has `p_via` defaulted), admin approve/reject-pending screen (`approve_profile`, `list_pending_profiles`).
5. Watch 24h (prod-admin checks + Supabase logs). **Gate to proceed:** all smoke tests pass, no new errors.

Rollback for Phase 1: migrations are additive and have no down scripts. Do not try to reverse them; because old code works
against the new schema, rolling forward is the answer. Worst case, restore from the Pre-flight backup.

## Phase 2: Code release (`dev` → `main`)

1. Merge on `release/dev-to-main` (conflict resolved per Pre-flight), PR into `main`, review the PR diff once more against
   the "Existing-behaviour changes" list above.
2. Re-run `scripts/release-drift-check.sh`; if dev moved, update this plan first. Re-run Phase 1 steps 1 and 3 if new
   migrations appeared (they ship in a mini Phase 1 *before* this merge).
3. Merge to `main`. Vercel builds production. Confirm via API that the new production deployment's `githubCommitRef` is `main`
   and the alias moved. (Do not trust the project overview alone: it can lag a promote/rollback.)
4. Smoke test on production (all flags still off), each as the right account type:
   - generator: sign in, create/save a manifest (`/manifests/new`), waste profile create, LDR prepared flow, label print, BOL
   - transporter/disposal: confirm redirected away from `/manifests/new`, `/ldr/new`, `/bol/new`; sign/look up still works
   - pending/rejected account: lands on `/pending-approval` (with the rejected variant for rejected)
   - admin: `/admin` loads, flags list shows the four new flags off
   - anonymous: `/login`, signup, `/scan` and the waste-line-edit link page load
5. Watch 24-48h: prod-admin report, Vercel runtime errors, Supabase logs.

Rollback for Phase 2: Vercel → Deployments → promote `emanifest-gmyhtc1bb` (proven on 2026-10-12/13). Schema stays (safe).
Note that after rollback, `main` must be reverted or the next push redeploys the bad build.

## Phase 3: Feature exposure (per flag, per account; no deploy needed)

Order, lowest risk first. Pause 24h+ between each and watch for errors.
1. `manifest_wizard` (no AI) → internal admin account only, then widen.
2. Profile Wizard (`manifestmate_wizard_generator`): **first add `AI_GATEWAY_API_KEY` to Vercel production and redeploy**; grant
   one test account tier `plus` via `/admin`; watch AI Gateway cost/usage; then third-party flag.
3. Segregation Wizard (`manifestmate_labpack_wizard_generator`): tier `pro`, same cost watch.
Flag off = instant rollback for any of these.

## Decisions for Matt

- Whether to add a Phase 1.5: a short pause with only the schema applied is cheap but delays features; recommended at least 24h.
- Whether to give `emanifest-app` Preview a sandbox-pointing Supabase env so previews stop touching prod data.
- Whether `manifestmate-sandbox` shares this repo (CLAUDE.md says unconfirmed); it matters for whether Phase 2's merge also moves
  `dev.`.

## Not yet verified (be honest at release time)

- Build and lint of `dev` / the merge branch. No automated test suite exists (CLAUDE.md).
- Prod PITR/backup status.
- Old-code-against-new-schema behaviour (only reasoned from the migrations; Phase 1 step 4 is the real test).
- Full read of all 32 migrations (pattern scan only).
- Any behaviour of authenticated pages (this review was code + schema + unauthenticated probes).

## Re-evaluation protocol

`dev` keeps moving. Before each phase (and at least weekly while the release is pending), run:

```
scripts/release-drift-check.sh            # commits, new migrations, risky patterns, env vars, conflicts since baseline
cd ~/emanifest-app && cat supabase/.temp/project-ref   # must be the project you intend
npx supabase link --project-ref kbevffgffynemttuqcfh && npx supabase migration list --linked   # prod applied list (read-only)
npx supabase link --project-ref fjyqhbnmfhlryehmeiyb                                              # ALWAYS re-link to sandbox after
```

Then decide, and record it in the log below:
- **New migration on `dev`** → read it; classify additive vs breaking; breaking ones need their own sub-phase
  (expand → deploy → contract). Update the "32" counts and baseline shas at the top.
- **New unguarded behaviour change** (middleware, auth, existing pages) → add to the smoke-test list.
- **New env var** → add to Pre-flight step 4.
- **Conflicts beyond `next.config.ts`** → resolve on the release branch before Phase 2.

## Re-evaluation log

| Date | dev tip | main tip | Dev-only migrations | Notes |
|---|---|---|---|---|
| 2026-10-13 | `9e8dfaa` | `cba8cb8` | 32 | Initial plan. Prod DB == `main` files; dry-run lists the 32. |
