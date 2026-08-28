-- Adds beta-tester NDA/Terms acceptance tracking. 2026-08-28 product
-- decision: every new self-serve registration (all account types, not
-- just generator -- this is broader than the generator-only approval gate
-- in 2026090601) must affirmatively accept the Beta Program Terms &
-- Confidentiality Agreement (clickwrap checkbox, see /beta-agreement and
-- authActions.ts's signUpAction) before an account is created. The
-- checkbox's value rides through supabase.auth.signUp()'s options.data
-- into raw_user_meta_data, same mechanism account_type already uses, and
-- this trigger persists it onto the profiles row at insert time.
--
-- No backfill for existing users -- this only applies going forward to new
-- registrations, not retroactively to accounts created before this
-- feature existed. nda_accepted_at stays null for every pre-existing row,
-- same reasoning as approved_at's "no backfill needed" in 2026090601 (that
-- one grandfathered existing users in; this one just doesn't apply to them
-- at all since nothing gates on it for already-registered accounts).
--
-- Dry-run tested against a pg_temp harness (temp tables + a pg_temp copy
-- of this function body) before being applied here, per this project's
-- apply-migration skill guidance for anything touching the auth.users
-- trigger -- covered: normal accept, explicit reject, missing nda fields,
-- garbage account_type, garbage nda_accepted value, null metadata, and
-- empty-string nda_version. All degraded safely (fall back to
-- generator/null rather than erroring), so unrelated signups can't be
-- broken by a missing field.

alter table public.profiles add column if not exists nda_accepted_at timestamptz;
alter table public.profiles add column if not exists nda_version text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, account_type, nda_accepted_at, nda_version)
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'account_type' in ('generator', 'transporter', 'disposal', 'third_party')
        then new.raw_user_meta_data->>'account_type'
      else 'generator'
    end,
    case when new.raw_user_meta_data->>'nda_accepted' = 'true' then now() else null end,
    nullif(new.raw_user_meta_data->>'nda_version', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
