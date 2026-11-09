-- Security fix, dev/sandbox only (ManifestMate security review, Matt 2026-11-09). The waste-line editor's lab-pack and
-- metadata functions exist only on dev; give them the same 10-minute claimed_at window as 2026110901 gave the shared
-- post-claim functions, and take the dev-only admin functions (they already check is_admin_caller / super admin) away from
-- anon. get_my_admin_role and the is_*_caller helpers are left callable: pages and policies use them to decide what to show.

-- list_waste_profiles_for_waste_line_token
CREATE OR REPLACE FUNCTION public.list_waste_profiles_for_waste_line_token(p_token_id uuid)
 RETURNS SETOF waste_profiles
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select wp.*
  from public.waste_profiles wp
  join public.waste_line_edit_tokens t on t.owner_user_id = wp.user_id
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes';
$function$;

-- list_lab_packs_for_waste_line_token
CREATE OR REPLACE FUNCTION public.list_lab_packs_for_waste_line_token(p_token_id uuid)
 RETURNS SETOF lab_packs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lp.*
  from public.lab_packs lp
  join public.waste_line_edit_tokens t on t.owner_user_id = lp.user_id
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes'
    and lp.epa_mtn is null;
$function$;

-- list_lab_pack_jobs_for_waste_line_token
CREATE OR REPLACE FUNCTION public.list_lab_pack_jobs_for_waste_line_token(p_token_id uuid)
 RETURNS TABLE(id uuid, job_number text, job_name text, generator_epa_id text, generator_name text, generator_address text, status text, epa_mtn text, drum_count bigint, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    j.id, j.job_number, j.job_name, j.generator_epa_id, j.generator_name,
    j.generator_address, j.status, j.epa_mtn,
    (select count(*) from public.lab_packs p where p.job_id = j.id) as drum_count,
    j.created_at, j.updated_at
  from public.lab_pack_jobs j
  join public.waste_line_edit_tokens t on t.owner_user_id = j.user_id
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes'
    and j.status <> 'linked';
$function$;

-- link_lab_pack_to_manifest_line_for_waste_line_token
CREATE OR REPLACE FUNCTION public.link_lab_pack_to_manifest_line_for_waste_line_token(p_token_id uuid, p_lab_pack_id uuid, p_line_number integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_owner_user_id uuid;
  v_epa_mtn text;
begin
  select t.owner_user_id, t.manifest_epa_mtn into v_owner_user_id, v_epa_mtn
  from public.waste_line_edit_tokens t
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes';

  if v_owner_user_id is null then
    raise exception 'Token not claimed';
  end if;

  update public.lab_packs
  set epa_mtn = v_epa_mtn, manifest_line_number = p_line_number, updated_at = now()
  where id = p_lab_pack_id
    and user_id = v_owner_user_id;
end;
$function$;

-- upsert_waste_line_metadata_for_waste_line_token
CREATE OR REPLACE FUNCTION public.upsert_waste_line_metadata_for_waste_line_token(p_token_id uuid, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_owner_user_id uuid;
  v_epa_mtn text;
begin
  select t.owner_user_id, t.manifest_epa_mtn into v_owner_user_id, v_epa_mtn
  from public.waste_line_edit_tokens t
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes';

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
$function$;

-- get_mirrored_manifest_for_waste_line_token
CREATE OR REPLACE FUNCTION public.get_mirrored_manifest_for_waste_line_token(p_token_id uuid)
 RETURNS TABLE(generator_name text, designated_facility_name text, designated_facility_epa_site_id text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select m.generator_name, m.designated_facility_name, m.designated_facility_epa_site_id
  from public.manifests m
  join public.waste_line_edit_tokens t
    on t.owner_user_id = m.user_id
    and t.manifest_epa_mtn = m.epa_mtn
  where t.id = p_token_id
    and t.used_at is not null
    and t.claimed_at > now() - interval '10 minutes';
$function$;

do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'grant_admin', 'revoke_admin', 'list_admins', 'list_rejected_profiles', 'reject_profile',
        'set_account_tier', 'list_accounts_for_tier', 'set_my_account_type'])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$do$;
