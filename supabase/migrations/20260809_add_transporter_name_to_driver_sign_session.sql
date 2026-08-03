-- The public /sign/[token] page shows the generator name and destination
-- facility name, but never the transporter company name the driver is
-- actually signing on behalf of -- the company name only ever appeared in
-- the invite SMS text (createDriverSignLinkAction), not on the page itself.
-- A driver who received a link for the wrong company (send-time mistake, or
-- a forwarded link) has no on-page way to notice, since there's nothing to
-- check it against. This snapshots the company name at send time, same
-- pattern as generator_name_snapshot/tsdf_name_snapshot, so DriverSignForm.tsx
-- can display and name it explicitly, matching GeneratorSignForm.tsx's
-- existing pattern of naming the entity in the acknowledgment text.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder. Depends on
-- 20260806_add_driver_phone_and_confirmation.sql already being applied.

alter table public.driver_sign_tokens
  add column if not exists transporter_company_name_snapshot text;

-- Both functions dropped first, not just `create or replace` -- Postgres
-- disallows changing a function's parameter list or return type via a bare
-- replace (same reasoning as 20260806's migration comment).

drop function if exists public.create_driver_sign_token(text, uuid, integer, text, text, text, text);

create or replace function public.create_driver_sign_token(
  p_manifest_epa_mtn text,
  p_transporter_id uuid,
  p_transporter_order integer,
  p_generator_name text,
  p_tsdf_name text,
  p_waste_line_summary text,
  p_driver_phone text,
  p_transporter_company_name text
)
returns table (token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be logged in to create a driver sign link';
  end if;

  insert into public.driver_sign_tokens (
    manifest_epa_mtn, transporter_id, transporter_order, created_by_user_id,
    generator_name_snapshot, tsdf_name_snapshot, waste_line_summary_snapshot,
    driver_phone, transporter_company_name_snapshot
  )
  values (
    p_manifest_epa_mtn, p_transporter_id, p_transporter_order, auth.uid(),
    p_generator_name, p_tsdf_name, p_waste_line_summary, p_driver_phone,
    p_transporter_company_name
  )
  returning driver_sign_tokens.token into v_token;

  return query select v_token;
end;
$$;

revoke all on function public.create_driver_sign_token(text, uuid, integer, text, text, text, text, text) from public;
grant execute on function public.create_driver_sign_token(text, uuid, integer, text, text, text, text, text) to authenticated;

drop function if exists public.get_driver_sign_session(uuid);

create or replace function public.get_driver_sign_session(p_token uuid)
returns table (
  epa_mtn text,
  transporter_order integer,
  generator_name text,
  tsdf_name text,
  waste_line_summary text,
  expires_at timestamptz,
  transporter_company_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      t.manifest_epa_mtn,
      t.transporter_order,
      t.generator_name_snapshot,
      t.tsdf_name_snapshot,
      t.waste_line_summary_snapshot,
      t.expires_at,
      t.transporter_company_name_snapshot
    from public.driver_sign_tokens t
    where t.token = p_token
      and t.used_at is null
      and t.expires_at > now();
end;
$$;

revoke all on function public.get_driver_sign_session(uuid) from public;
grant execute on function public.get_driver_sign_session(uuid) to anon, authenticated;
