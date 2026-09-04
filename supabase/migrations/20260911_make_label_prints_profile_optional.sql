-- Labels can now be generated straight from a manifest's waste lines at
-- shipment time, not only from a saved waste profile (2026-09-04 design
-- discussion: print at Save/Save & Sign, covering profiled AND freeform
-- lines). A manifest-sourced label has no profile to number, so
-- mm_profile_number can no longer be guaranteed -- drop the not-null
-- constraint. profile_name stays not-null: for a manifest-sourced label
-- it's populated with the line's own waste description/proper shipping
-- name as a stand-in, same slot a saved profile's name would occupy.
alter table label_prints
  alter column mm_profile_number drop not null;
