---
name: apply-migration
description: Use when writing a new Supabase migration for emanifest-app, when checking whether a migration has actually been applied to the live database, or when a feature built on a new table/column is behaving as if the schema change never happened. This project has no Supabase CLI or service key wired up, so migrations are a manual, easy-to-miss step — this skill covers how to write, apply, and actually verify one.
---

# Supabase migrations in emanifest-app

## No CLI — migrations are manual

`supabase/migrations/` holds timestamp-prefixed raw SQL files, but there is
**no migration-runner CLI wired up in this environment** — only the anon key
is available (checked in `.env.local`), not a service key or linked CLI
project. A new migration file is not "done" when it's written; it isn't real
until someone pastes it into the **Supabase Dashboard's SQL Editor** and
runs it there. Always say this explicitly when you finish writing a
migration — don't let "I added the migration" be read as "the schema
change is live."

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
