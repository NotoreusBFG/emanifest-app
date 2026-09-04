-- Adds LQG biennial-report-prep fields to waste_profiles: an expected
-- shipment size/cadence and specific gravity (for converting a
-- volume-based estimate to weight, since the biennial report wants
-- generated quantities by weight). Requested 2026-09-04.

alter table waste_profiles
  add column if not exists estimated_container_count integer,
  add column if not exists estimated_quantity numeric,
  add column if not exists shipment_frequency text
    check (shipment_frequency in ('one_time', 'monthly', 'quarterly', 'biannual', 'annual', 'other')),
  add column if not exists shipment_frequency_other text not null default '',
  add column if not exists specific_gravity numeric;
