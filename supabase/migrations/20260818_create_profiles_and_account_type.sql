-- Minimal role/account-type storage for the multi-role account feature
-- (MM2.0 slice 1). No profiles table has existed before this -- auth.users
-- is otherwise only ever joined via scattered user_id FKs. This is
-- deliberately thin: just enough to drive nav branching. It is NOT the
-- security boundary for the transporter dashboard -- that's
-- transporters.owner_user_id (see 20260820's
-- list_manifests_for_transporter_owner()). account_type here is a UX
-- signal only.
--
-- Scope: 'generator' and 'transporter' ONLY. Disposal facility and broker
-- are explicitly out of scope for this slice -- do not add them to the
-- check constraint.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'generator'
    check (account_type in ('generator', 'transporter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read-only from the client's perspective -- account_type is set once at
-- signup (via the trigger below) and never self-edited in this slice, so
-- there's deliberately no insert/update policy for `authenticated`. All
-- provisioning happens through the SECURITY DEFINER trigger function,
-- which bypasses RLS as the function owner (consistent with this
-- project's established SECURITY DEFINER convention for anything that
-- needs to write across an ownership boundary the client itself
-- shouldn't).
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Provisions a profiles row the moment a new auth.users row is created,
-- reading account_type out of the signup call's options.data (see
-- authActions.ts's signUpAction). Falls back to 'generator' if absent --
-- e.g. any signup path that doesn't pass it -- keeping this fail-safe to
-- the existing, non-breaking default.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, account_type)
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'account_type' in ('generator', 'transporter')
        then new.raw_user_meta_data->>'account_type'
      else 'generator'
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill: every EXISTING user (the entire live generator base) gets a
-- 'generator' row now, so layout.tsx's nav lookup is correct for them
-- immediately, with no gap between this migration running and any code
-- deploy.
insert into public.profiles (user_id, account_type)
select id, 'generator' from auth.users
on conflict (user_id) do nothing;
