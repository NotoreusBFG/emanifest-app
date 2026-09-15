-- Lets the Unlock step on /edit-waste-lines/[token] read the manifest's
-- designated-facility EPA ID (needed for the profile/lab-pack/QR-scan
-- facility-mismatch checks) from the local `manifests` mirror instead of
-- a live RCRAInfo getManifest() call. The mirror is written by
-- recordManifestLocally right after the manifest was created, and a
-- manifest's designated facility never changes afterward -- so this is a
-- safe substitute for a value that previously cost a real EPA API call on
-- every Unlock click, including ones that only wanted to scan a QR code.
-- Same SECURITY DEFINER / claimed-token trust boundary as the other
-- functions in 2026092206_waste_line_edit_delegate_data_access.sql --
-- `manifests` is locked to `auth.uid() = user_id` with no anon policy.
create or replace function public.get_mirrored_manifest_for_waste_line_token(p_token_id uuid)
returns table (
  generator_name text,
  designated_facility_name text,
  designated_facility_epa_site_id text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select m.generator_name, m.designated_facility_name, m.designated_facility_epa_site_id
  from public.manifests m
  join public.waste_line_edit_tokens t
    on t.owner_user_id = m.user_id
    and t.manifest_epa_mtn = m.epa_mtn
  where t.id = p_token_id
    and t.used_at is not null;
$$;

revoke all on function public.get_mirrored_manifest_for_waste_line_token(uuid) from public;
grant execute on function public.get_mirrored_manifest_for_waste_line_token(uuid) to anon, authenticated;
