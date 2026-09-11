-- Links a manifest waste line to the lab pack (drum) that was loaded onto
-- it, alongside the wastewater/lab-pack flags already captured per line
-- (20260731, 20260802). Rides the same (user_id, epa_mtn, line_number) key
-- -- no change to that table's identity or existing rows.
--
-- On delete set null (not cascade): if a lab pack is ever deleted, the
-- manifest waste line metadata row (and its is_lab_pack/wastewater_category
-- values, which are independently meaningful) should survive; only the
-- link itself is cleared.

alter table public.manifest_waste_line_metadata
  add column if not exists lab_pack_id uuid references public.lab_packs(id) on delete set null;

create index if not exists manifest_waste_line_metadata_lab_pack_id_idx
  on public.manifest_waste_line_metadata(lab_pack_id) where lab_pack_id is not null;
