-- Admin-controlled feature flags for gradual rollout / instant rollback of
-- risky, not-yet-fully-tested mm2.0 features (multi-role accounts, sidebar
-- nav). Off by default. Only notoreusbfg@gmail.com can flip these (enforced
-- both by the RLS update policy below and again in the app's Server Action).
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table feature_flags enable row level security;

-- Readable by anyone (logged in or not) — layout.tsx needs to check this on
-- every request, and there's nothing sensitive in a boolean flag name/value.
create policy "feature_flags_select_all" on feature_flags
  for select using (true);

-- Only the admin account can flip a flag.
create policy "feature_flags_update_admin" on feature_flags
  for update
  using (auth.jwt() ->> 'email' = 'notoreusbfg@gmail.com')
  with check (auth.jwt() ->> 'email' = 'notoreusbfg@gmail.com');

insert into feature_flags (key, enabled) values ('mm2_ui', false)
  on conflict (key) do nothing;
