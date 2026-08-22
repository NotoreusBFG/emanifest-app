alter table leads add column if not exists removed_at timestamptz;
create index if not exists leads_removed_at_idx on leads (removed_at);
