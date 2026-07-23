-- Stores each user's encrypted RCRAInfo API credentials.
-- Run this in the Supabase Dashboard -> SQL Editor (or via `supabase db push`
-- once the CLI is linked to the project).

create table if not exists public.user_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epa_api_id text not null,
  epa_api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_credentials enable row level security;

-- Each user may only read/write their own row.
-- Postgres has no `create policy if not exists`, so drop-then-create makes
-- this script safe to re-run.
drop policy if exists "Users can view their own EPA credentials" on public.user_credentials;
create policy "Users can view their own EPA credentials"
  on public.user_credentials for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own EPA credentials" on public.user_credentials;
create policy "Users can insert their own EPA credentials"
  on public.user_credentials for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own EPA credentials" on public.user_credentials;
create policy "Users can update their own EPA credentials"
  on public.user_credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own EPA credentials" on public.user_credentials;
create policy "Users can delete their own EPA credentials"
  on public.user_credentials for delete
  using (auth.uid() = user_id);
