-- Per-category cold-call/talking-points scripts for the lead tracker's
-- call sheet. Schema only, deliberately no seed data here — script
-- content is sales/business messaging, same category of thing as
-- private-notes/marketing/ (see CLAUDE.md's repo-privacy-split note),
-- and this repo is public on GitHub. Actual script text gets written via
-- the admin UI (or a one-off `supabase db query`, same pattern already
-- used for admin_users), never committed in a migration file.

create table if not exists call_scripts (
  category text primary key,
  script text not null,
  updated_at timestamptz not null default now()
);

alter table call_scripts enable row level security;

create policy "call_scripts_admin_all" on call_scripts
  for all
  using (is_admin_caller())
  with check (is_admin_caller());
