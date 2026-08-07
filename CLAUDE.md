# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

ManifestMate — a Next.js app that lets hazardous-waste generators, transporters,
and disposal facilities prepare and sign EPA electronic manifests (e-Manifest)
without each party needing full EPA/RCRAInfo credentials themselves. It's a thin
UI + orchestration layer over the EPA RCRAInfo e-Manifest REST API, backed by
Supabase for auth/storage/app data.

## Commands

- `npm run dev` — start the dev server (this is the only way the app currently runs; no deployment yet, see `docs/deployment-and-email-setup.md`)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- No automated test suite (no jest/vitest configured, `playwright` is an unused devDependency). `scripts/test-*.ts` are one-off manual integration scripts that hit the **live preprod RCRAInfo API** — run individually with `npx tsx scripts/<name>.ts`, not as a suite. Treat them as verification tools, not CI.

## Architecture

**Layering:** `src/app/**/page.tsx` (UI) → `src/app/actions/*Actions.ts` (Next.js
Server Actions — the mutation entry points) → `src/services/*Repository.ts` /
`*Service.ts` (Supabase queries + business logic) → `src/lib/rcrainfo/client.ts`
(the actual EPA API calls). There's almost no REST API surface of our own —
`src/app/api/manifests/[mtn]/attachments/route.ts` is the one exception (file
upload needs a route handler, not a Server Action). Prefer this Server
Action pattern for new mutations rather than adding API routes.

**RCRAInfo integration** (`src/lib/rcrainfo/`): `client.ts` is a hand-written
client for EPA's e-Manifest API (preprod vs prod chosen via `RCRAINFO_ENV`).
`MANIFEST_SCHEMA.md` and `README.md` in that directory are working notes from
live-testing the API — read them before touching manifest save/sign logic;
Swagger's documented schema doesn't always match what the live API actually
requires, and error responses have historically been the more reliable spec.

**Credential resolution** (`src/services/manifestService.ts`): every RCRAInfo
call needs a per-user API id/key pair, encrypted at rest
(`src/lib/cryptoUtils.ts`, AES-256, key from `ENCRYPTION_SECRET_KEY`). Two
resolver functions, both important to pick correctly:
- `getRcrainfoClientForUser` — caller's own credentials only. Used for
  manifest **creation**, which is deliberately not delegable.
- `getRcrainfoClientForAction` — caller's own credentials, or falls back to an
  active Quick-Sign delegation's owner credentials (see below). Used for
  **lookup and signing**.

**Quick-Sign delegation model** (`docs/delegate-quick-sign-design.md`,
`src/services/delegateRepository.ts`): an owner can invite someone else
(e.g. a driver) to sign manifests on their behalf without sharing RCRAInfo
credentials, scoped by role (`allowed_site_types`: generator/transporter/etc,
not per-site). A delegated action always records data under the **owner's**
`effectiveUserId`, not the delegate's — so the owner's dashboard stays the
single source of truth. Read the doc's "v1 decisions" section before changing
anything here; several behaviors (one active delegation per delegate, no
delegate-owned dashboard, generator-role opt-in flagged in UI) are deliberate,
not accidental gaps. `docs/manifest-workflow-and-permissions.md` explains the
underlying EPA rule this all rests on: preparing a manifest and signing it are
governed by different RCRAInfo permissions, which is what makes this whole
product possible.

**Supabase clients** (`src/lib/supabase/`) — three separate entry points, use
the right one for the context: `browserClient.ts` (Client Components),
`server.ts` (Server Components/Actions), `middleware.ts` (session refresh,
wired into `src/middleware.ts`). Migrations in `supabase/migrations/` are
timestamp-prefixed raw SQL, applied manually via the Supabase Dashboard SQL
editor — there's no migration-runner CLI wired up, so a new migration file
isn't "done" until someone actually runs it there.

**Notifications**: `src/lib/email/resendClient.ts` and `src/lib/sms/twilioClient.ts`
are both deliberately dependency-free (raw `fetch` against Resend/Twilio REST
APIs, no SDK) and both throw a typed `*NotConfiguredError` when credentials are
missing — callers should treat that as an expected, handleable case (fall back
to a shareable link), not a bug. Neither provider is fully configured yet in
this project.

**Domain reference data** (`src/lib/hazmat/`, `src/lib/stateWasteCodes.ts`,
`docs/waste-codes-reference.json`, `docs/un-waste-codes.json`): large generated
lookup tables for DOT/EPA waste and hazmat codes — treat as data, not code to
hand-edit.

## Environment

`.env.local` (gitignored) needs: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ENCRYPTION_SECRET_KEY`, `RCRAINFO_ENV`
(`preprod`|`prod`), `RCRAINFO_API_ID`, `RCRAINFO_API_KEY`, `RESEND_API_KEY`,
`RESEND_EMAIL_DOMAIN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID` (Vercel Blob),
`ADMIN_EMAILS` (comma-separated, gates `/admin` and feature-flag actions —
see `src/lib/admin.ts`; moved out of source 2026-08-07 since this repo is
public on GitHub and a hardcoded admin email is free phishing-target info).
RCRAInfo is currently pointed at EPA's **preprod sandbox**, not production —
don't assume live manifest actions have real-world regulatory effect unless
`RCRAINFO_ENV=prod` is confirmed.
