-- Gives the anonymous waste-line-edit delegate (/edit-waste-lines/[token])
-- access to the owner's saved waste profiles and lab pack drums/jobs, so
-- they don't have to retype every field from scratch -- same data the
-- owner's own /manifests/new form already shows via ManifestFieldsForm's
-- wasteProfiles/labPacks/labPackJobs props.
--
-- waste_profiles, lab_packs, and lab_pack_jobs are all locked to
-- `auth.uid() = user_id` with no anon policy, and this app has no
-- service-role client anywhere -- every anonymous read/write elsewhere in
-- this app goes through a SECURITY DEFINER function instead (see
-- 20260827_create_waste_line_edit_tokens.sql). These functions follow that
-- same convention, gated on `t.used_at is not null` -- i.e. only callable
-- on an ALREADY-CLAIMED token, same trust boundary
-- get_owner_credentials_for_waste_line_token already uses.

-- Read: all of the owner's saved waste profiles.
create or replace function public.list_waste_profiles_for_waste_line_token(p_token_id uuid)
returns setof public.waste_profiles
language sql
security definer
set search_path = public, pg_temp
as $$
  select wp.*
  from public.waste_profiles wp
  join public.waste_line_edit_tokens t on t.owner_user_id = wp.user_id
  where t.id = p_token_id
    and t.used_at is not null;
$$;

revoke all on function public.list_waste_profiles_for_waste_line_token(uuid) from public;
grant execute on function public.list_waste_profiles_for_waste_line_token(uuid) to anon, authenticated;

-- Read: the owner's unlinked (not yet applied to any manifest) lab pack
-- drums -- same `epa_mtn is null` filter /manifests/new/page.tsx applies
-- client-side.
create or replace function public.list_lab_packs_for_waste_line_token(p_token_id uuid)
returns setof public.lab_packs
language sql
security definer
set search_path = public, pg_temp
as $$
  select lp.*
  from public.lab_packs lp
  join public.waste_line_edit_tokens t on t.owner_user_id = lp.user_id
  where t.id = p_token_id
    and t.used_at is not null
    and lp.epa_mtn is null;
$$;

revoke all on function public.list_lab_packs_for_waste_line_token(uuid) from public;
grant execute on function public.list_lab_packs_for_waste_line_token(uuid) to anon, authenticated;

-- Read: the owner's open (not yet linked) lab pack jobs, with a computed
-- drum count -- mirrors listLabPackJobsForUser's JOB_SELECT_WITH_COUNT.
create or replace function public.list_lab_pack_jobs_for_waste_line_token(p_token_id uuid)
returns table (
  id uuid,
  job_number text,
  job_name text,
  generator_epa_id text,
  generator_name text,
  generator_address text,
  status text,
  epa_mtn text,
  drum_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    j.id, j.job_number, j.job_name, j.generator_epa_id, j.generator_name,
    j.generator_address, j.status, j.epa_mtn,
    (select count(*) from public.lab_packs p where p.job_id = j.id) as drum_count,
    j.created_at, j.updated_at
  from public.lab_pack_jobs j
  join public.waste_line_edit_tokens t on t.owner_user_id = j.user_id
  where t.id = p_token_id
    and t.used_at is not null
    and j.status <> 'linked';
$$;

revoke all on function public.list_lab_pack_jobs_for_waste_line_token(uuid) from public;
grant execute on function public.list_lab_pack_jobs_for_waste_line_token(uuid) to anon, authenticated;

-- Write: marks a lab pack drum as loaded onto a specific manifest line --
-- same single-row update linkLabPackToManifestLine already does, scoped
-- through the claimed token's owner instead of a session user id.
create or replace function public.link_lab_pack_to_manifest_line_for_waste_line_token(
  p_token_id uuid,
  p_lab_pack_id uuid,
  p_line_number integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_user_id uuid;
  v_epa_mtn text;
begin
  select t.owner_user_id, t.manifest_epa_mtn into v_owner_user_id, v_epa_mtn
  from public.waste_line_edit_tokens t
  where t.id = p_token_id
    and t.used_at is not null;

  if v_owner_user_id is null then
    raise exception 'Token not claimed';
  end if;

  update public.lab_packs
  set epa_mtn = v_epa_mtn, manifest_line_number = p_line_number, updated_at = now()
  where id = p_lab_pack_id
    and user_id = v_owner_user_id;
end;
$$;

revoke all on function public.link_lab_pack_to_manifest_line_for_waste_line_token(uuid, uuid, integer) from public;
grant execute on function public.link_lab_pack_to_manifest_line_for_waste_line_token(uuid, uuid, integer) to anon, authenticated;

-- Write: same upsert upsertWasteLineMetadata already does, scoped through
-- the claimed token's owner. p_lines is a jsonb array of
-- {line_number, wastewater_category, is_lab_pack, lab_pack_id}.
create or replace function public.upsert_waste_line_metadata_for_waste_line_token(
  p_token_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_user_id uuid;
  v_epa_mtn text;
begin
  select t.owner_user_id, t.manifest_epa_mtn into v_owner_user_id, v_epa_mtn
  from public.waste_line_edit_tokens t
  where t.id = p_token_id
    and t.used_at is not null;

  if v_owner_user_id is null then
    raise exception 'Token not claimed';
  end if;

  insert into public.manifest_waste_line_metadata (
    user_id, epa_mtn, line_number, wastewater_category, is_lab_pack, lab_pack_id, updated_at
  )
  select
    v_owner_user_id,
    v_epa_mtn,
    (l->>'line_number')::integer,
    l->>'wastewater_category',
    (l->>'is_lab_pack')::boolean,
    nullif(l->>'lab_pack_id', '')::uuid,
    now()
  from jsonb_array_elements(p_lines) as l
  on conflict (user_id, epa_mtn, line_number) do update
  set wastewater_category = excluded.wastewater_category,
      is_lab_pack = excluded.is_lab_pack,
      lab_pack_id = excluded.lab_pack_id,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_waste_line_metadata_for_waste_line_token(uuid, jsonb) from public;
grant execute on function public.upsert_waste_line_metadata_for_waste_line_token(uuid, jsonb) to anon, authenticated;

-- Un-claims a token after a successful "peek" (the Unlock step reading
-- profiles/lab-packs) WITHOUT incrementing failed_attempt_count -- unlike
-- release_waste_line_edit_token, which is for a WRONG MMIN and should
-- count against the retry cap. Reusing that function here would wrongly
-- penalize a correct code entry.
create or replace function public.release_waste_line_edit_token_after_peek(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.waste_line_edit_tokens
  set used_at = null
  where id = p_token_id;
end;
$$;

revoke all on function public.release_waste_line_edit_token_after_peek(uuid) from public;
grant execute on function public.release_waste_line_edit_token_after_peek(uuid) to anon, authenticated;
