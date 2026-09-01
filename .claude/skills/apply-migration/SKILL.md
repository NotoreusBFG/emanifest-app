---
name: apply-migration
description: Use when writing a new Supabase migration for emanifest-app, when checking whether a migration has actually been applied to the live database, or when a feature built on a new table/column is behaving as if the schema change never happened. The Supabase CLI is now linked (as of 2026-08-17) — this skill covers how to write, push, and actually verify a migration, plus a real filename gotcha this project already hit once.
---

# Supabase migrations in emanifest-app

## Two projects now — check which one is linked

As of 2026-08-31 there are two Supabase projects (see
`private-notes/admin-notes/site-administration.md` for the full split):
production (`kbevffgffynemttuqcfh`, backs `hazwastemanifestmate.com`) and
sandbox (`fjyqhbnmfhlryehmeiyb`, backs `dev.hazwastemanifestmate.com`).
The Supabase CLI link is per-machine, not per-migration — **local dev is
now linked to sandbox by default**, not production. Before running
`db push`, check which project is actually linked:

```
cat supabase/.temp/project-ref   # or: npx supabase projects list (look for "linked":true)
```

To push a migration to production specifically, re-link first
(`npx supabase link --project-ref kbevffgffynemttuqcfh`), push, then
re-link back to sandbox (`npx supabase link --project-ref fjyqhbnmfhlryehmeiyb`)
so local dev doesn't stay pointed at production afterward.

## CLI is linked — use `supabase db push`

`supabase/migrations/` holds timestamp-prefixed raw SQL files. As of
2026-08-17, the Supabase CLI is installed as a local devDependency and
linked (see above for which project). To apply new migrations:

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

**Ordering gotcha, hit 2026-08-31 standing up the sandbox project from
scratch:** `2026081101_add_generator_manifest_search_flag.sql` (2026-08-11)
inserts a row into `feature_flags`, but that table isn't created until
`20260823_create_feature_flags.sql` (2026-08-23) — a full 12 days later.
This only ever worked on the production project because the table
happened to get created out of order at some point (manually, or via an
earlier ad hoc run) before the flag-insert migration ran there for real.
A genuinely fresh `db push` (new environment, or disaster recovery) fails
on it every time with `relation "feature_flags" does not exist`. Worked
around for the sandbox push by manually creating the bare table via SQL
before resuming `db push`, but **the underlying migration file itself
still needs a permanent fix**: prepend the same `create table if not
exists feature_flags (...)` block (copied from `20260823`'s definition)
to the top of `2026081101_add_generator_manifest_search_flag.sql`. That's
safe to do even though `2026081101` is already applied to production —
`if not exists` is a no-op there since the table already exists, and
`20260823`'s own `create table if not exists` later in the sequence stays
a no-op too. Don't rename either file's timestamp prefix to "fix" the
ordering — that would create the same kind of local/remote version
mismatch already seen once with the 2026-09-06 collision (see
`db push`/`migration list` output showing local/remote version pairs
that don't line up if this is ever attempted).

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

Updated 2026-08-31: the Supabase org is now on **Pro** (upgraded to allow
the sandbox project past the free tier's 2-project cap), but that alone
doesn't mean backups are on — Pro makes point-in-time recovery *available*,
it isn't automatically configured just from the plan upgrade. Verify PITR
is actually turned on for the production project (`kbevffgffynemttuqcfh`)
before treating this as resolved; don't assume it from the plan tier alone.
The sandbox project (`fjyqhbnmfhlryehmeiyb`) is a separate environment
with its own (currently empty-of-real-data) database, **not** a
production failover/backup target — still worth surfacing this distinction
if a migration carries real risk (e.g. touching `auth.users`,
dropping/altering an existing column with live data).
