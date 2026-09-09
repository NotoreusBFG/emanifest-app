-- Adds an explicit waste_category (hazardous / non_hazardous / universal)
-- as the first choice a user makes when creating a waste profile --
-- previously only loosely inferable from is_rcra_waste, which has no way
-- to represent Universal Waste (40 CFR 273) at all: it's neither a full
-- RCRA-manifested hazardous waste nor an ordinary non-hazardous waste.
-- Drives the profile card's border color in the UI (yellow/blue/dark
-- purple) and is now the primary classifier shown first in the create
-- form; dot_hazardous/is_rcra_waste stay as separate, still-editable
-- fields underneath it -- their existing meaning (DOT hazmat shipping
-- paper requirement, and whether "Waste" prints on the label) doesn't
-- collapse cleanly into one 3-way category on its own (e.g. some
-- universal waste is still DOT-regulated for shipping).

alter table waste_profiles
  add column if not exists waste_category text not null default 'hazardous'
    check (waste_category in ('hazardous', 'non_hazardous', 'universal'));

-- Backfill: no prior universal-waste concept existed, so every existing
-- row becomes 'hazardous' or 'non_hazardous' based on is_rcra_waste, the
-- closest existing signal.
update waste_profiles set waste_category = case when is_rcra_waste then 'hazardous' else 'non_hazardous' end;
