---
name: verify-changes
description: Use when verifying that a code change in emanifest-app (ManifestMate) actually works — before claiming a typecheck/build/lint passed, before/after using Playwright for UI verification, or when the dev server is acting up (webpack crashes, 404ing /_next/static chunks, stale-looking pages). Contains known landmines that have previously produced false "all clear" results.
---

# Verifying changes in emanifest-app

This project has a history of verification commands *looking* clean while
actually being broken. Don't trust a green result from memory — follow the
checks below.

## Typecheck / build

- **Never rely on bare `npx tsc --noEmit -p .`** as sufficient verification,
  especially piped through a grep filter. It was silently broken for a long
  stretch: an invalid `tsconfig.json` `ignoreDeprecations` value made every
  invocation error out immediately, and a `grep -v ignoreDeprecations` filter
  happened to hide exactly that error line, making a fully broken typecheck
  print nothing and look like a clean pass.
- **Use `npm run build`** as the real verification step — it runs full
  production type checking without that landmine, and also catches things
  `tsc` alone misses (e.g. missing `Suspense` boundaries for
  `useSearchParams`, routes that fail to compile).
- If you do want a quick standalone `tsc` check, first confirm
  `tsconfig.json`'s `ignoreDeprecations` value still matches the actual
  installed TypeScript version (`npx tsc --version` vs. `package.json`) —
  this exact landmine can recur after a TypeScript upgrade.
- `npm run lint` should also run clean. ESLint was once silently dropped
  from `package.json` entirely (Next.js just skips linting when it's
  missing, no error) and nobody noticed for a long time. If lint looks
  suspiciously clean on a large diff, verify `eslint` and
  `eslint-config-next` are actually still present in `package.json` rather
  than assuming.

## Don't corrupt a live dev server

`npm run build` writes into the same `.next` directory a running
`next dev` uses, and has corrupted a live dev session mid-session before
(symptom: page renders but styling breaks — nav loses all spacing, looks
like raw unstyled HTML).

Before running `npm run build` for verification:
1. Check whether a dev server is live and in active use:
   `ps aux | grep "next dev"`.
2. If the user is actively using it, either skip the full build (a
   version-matched plain `tsc` check is enough for a routine change) or
   warn them their dev server may need a restart afterward.
3. If it does get corrupted: kill the dev process, `rm -rf .next` (safe,
   regenerated on next start), `npm run dev` fresh — a hard browser refresh
   may also be needed on top of that (stale cached CSS).

## Dev server flakiness

Recurring symptoms: a webpack `__webpack_modules__ is not a function`
crash, or the app looking fine server-rendered but every `/_next/static/`
JS/CSS chunk 404ing (client-side JS totally broken, HTML still renders).

Root cause both times traced back to a stale `.next` build combined with
**duplicate `next dev` processes** left running on the same port from a
previous restart that wasn't fully killed.

Fix: `ps aux | grep "next dev"`, kill **all** matches (not just the most
recent one), `rm -rf .next`, restart.

Also: something outside this sandbox's visible process list can already
hold port 3000, so Next silently falls back to 3002/3003 — check the
actual `- Local:` line in the dev server's own log rather than assuming
port 3000.

Before any Playwright check, confirm the dev server is actually healthy
right now (curl the root URL, expect a real 200) rather than assuming a
server started earlier in the session is still good after many edits.

## Playwright (headless UI verification)

- Chromium binary lives outside the repo
  (`~/.var/app/com.visualstudio.code/cache/ms-playwright/`) and does **not**
  survive a machine reinstall even though `node_modules` does. If it's
  missing, `npx playwright install chromium` alone is enough — skip
  `--with-deps`, it fails in this sandbox (`spawn su ENOENT`) and isn't
  needed.
- Scripts must live inside the project tree (e.g. under `scripts/`) or set
  `NODE_PATH=./node_modules` — a script run from a scratchpad/temp directory
  will fail with `MODULE_NOT_FOUND` on `require('playwright')`.
- Working pattern: write a throwaway script under `scripts/`,
  `node scripts/foo.js`, delete it when done. Useful for logged-out page
  checks (screenshot + `page.on('response')` watching for 4xx/5xx), click-
  throughs, and DOM-state checks like confirming a `<video>` element's
  `readyState`/`currentTime` show it's actually playing, not just present.
