-- Widens profiles.account_type beyond generator/transporter.
--
-- 20260818_create_profiles_and_account_type.sql deliberately scoped this to
-- 'generator' and 'transporter' ONLY and said not to add disposal/broker to
-- the check constraint without an explicit product-scope decision. That
-- decision has now been made: account_type should model all four site
-- roles ManifestMate ultimately supports -- generator, transporter,
-- disposal (designated facility), and third_party (broker/consultant) --
-- so the schema doesn't need another migration each time a new role's UI
-- ships.
--
-- This is schema-only. No signup path, trigger fallback, or nav branching
-- sets account_type to 'disposal' or 'third_party' yet -- only generator
-- (default/self-serve) and transporter (invite-only, see authActions.ts)
-- are actually reachable today. 'disposal' and 'third_party' are enabled
-- here so future work building those account types doesn't also need a
-- schema change.
--
-- Run this in the Supabase Dashboard -> SQL Editor (or `supabase db push`),
-- same as every other migration in this folder.

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('generator', 'transporter', 'disposal', 'third_party'));

-- Keep the signup trigger's allowlist in sync with the constraint above so
-- a future signup path can pass account_type: 'disposal' | 'third_party'
-- in raw_user_meta_data and have it actually persist, instead of silently
-- falling back to 'generator'. No caller does this yet.
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
      when new.raw_user_meta_data->>'account_type' in ('generator', 'transporter', 'disposal', 'third_party')
        then new.raw_user_meta_data->>'account_type'
      else 'generator'
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
