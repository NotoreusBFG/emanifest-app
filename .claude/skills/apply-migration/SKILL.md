---
name: apply-migration
description: Use when writing a new Supabase migration for emanifest-app, when checking whether a migration has actually been applied to the live database, or when a feature built on a new table/column is behaving as if the schema change never happened. The Supabase CLI is now linked (as of 2026-08-17) — this skill covers how to write, push, and actually verify a migration, plus a real filename gotcha this project already hit once.
---

# Supabase migrations in emanifest-app

## CLI is linked — use `supabase db push`

`supabase/migrations/` holds timestamp-prefixed raw SQL files. As of
2026-08-17, the Supabase CLI is installed as a local devDependency and
linked to this project (`npx supabase link --project-ref kbevffgffynemttuqcfh`,
login is user-level via `~/.supabase/`, no re-auth needed). To apply new
migrations:

```
npx supabase db push --dry-run   # preview what would run, always do this first
npx supabase db push             # actually apply
```

A new migration file is not "done" when it's written — it isn't live until
`db push` actually runs it (or, as a fallback, someone pastes it into the
Supabase Dashboard's SQL Editor). Always say this explicitly when you
finish writing a migration — don't let "I added the migration" be read as
"the schema change is live."

**Filename gotcha, already hit once:** this project's migration files use a
date-only prefix (`YYYYMMDD_name.sql`, no time component), but the CLI
treats that whole prefix as the migration's unique version. Two files
created on the same calendar day collide, and `db push` will refuse the
second one with `LegacyDbPushMissingRemoteError` until it's renamed. Nine
pre-existing files hit this and were renamed with a 2-digit suffix
(`YYYYMMDD01_name.sql`, `YYYYMMDD02_name.sql`, ...) to fix it. **When two
migrations are written on the same day, give the second one a 2-digit
suffix from the start** (e.g. `2026082601_x.sql`, `2026082602_y.sql`)
rather than two bare `20260826_*.sql` files.

## Don't trust "I ran it" — verify

A migration was reported as applied once but silently wasn't; the app
degraded gracefully (repository functions swallow/log errors instead of
throwing) which masked it until a confusing blank `{}` console error showed
up on a page depending on the new table.

After a migration is supposed to be live, verify it actually is with a
lightweight anon-key REST/RPC probe against the new table/column/function,
rather than assuming the user's "done" means done. This is the same
technique that caught a real migration-lag bug before.

Also watch for: a table that already exists via Supabase's Table Editor UI
scaffold (auto-created with just `id`, `created_at`, `updated_at`) can shadow
a migration meant to create that table properly with its full column set —
if a fresh migration's columns don't show up after running it, check
whether the table already existed before assuming the SQL itself is wrong.

## Migrations touching `auth.users` or other shared/production tables

If a migration adds a trigger or otherwise touches `auth.users` directly —
this fires for every future signup, including real production ones — do a
fully isolated dry run first:

- Build a `pg_temp`-scoped copy of the trigger/function.
- Fire it against throwaway temp tables, never the real `auth.users` /
  `profiles` tables.
- This specifically avoids triggering a real Supabase Auth webhook mid-test.
- Walk through realistic test cases (valid input, missing key, garbage
  value, null metadata, etc.) against the dry run before applying the real
  migration.

## Backup posture

This project's Supabase project is on the free tier with **no automatic
point-in-time recovery / backups**, and there is no second project to
fail over to (the user's other org project is already used by a different
app). This is a known, explicitly-accepted risk, not an oversight — worth
surfacing again if a migration carries real risk (e.g. touching `auth.users`,
dropping/altering an existing column with live data), but don't relitigate
the general free-tier decision each time.
