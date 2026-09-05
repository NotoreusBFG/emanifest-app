-- Printing labels for a generator's saved profiles ahead of any shipment
-- (2026-09-05 design: search a generator, batch-print labels straight
-- from their saved waste profiles, no manifest involved yet) needs to
-- allow a blank accumulation start date -- the container may not have
-- started accumulating yet, and the physical label already has a
-- write-in-style underlined box for this field, so a blank one is
-- meant to be filled in by hand later, not an error state.
alter table label_prints
  alter column accumulation_start_date drop not null;
