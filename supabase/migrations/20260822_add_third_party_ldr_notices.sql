-- Third-party LDR notices: lets a user record an LDR notice that a third
-- party (the receiving facility, a broker, a lab, etc.) already prepared
-- and sent as a PDF, instead of building one through ManifestMate's own
-- structured A-I letter form (20260801_redesign_ldr_notices_management_letters.sql).
-- ManifestMate isn't certifying anything on these -- it's just storing the
-- document and tracking which MTN it belongs to; the actual PDF lives in
-- ldr_notice_attachments (20260821_create_ldr_notice_attachments.sql).
--
-- Unlike a "prepared" notice, generator/receiving-facility/waste-line data
-- is genuinely optional here -- the record of record is the uploaded PDF,
-- not anything ManifestMate synthesizes. `epa_mtn` is the tracking key
-- instead, and per the user's own framing can be left blank at first
-- ("unattached"/"orphaned" on the list) and filled in later.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

alter table public.ldr_notices
  alter column generator_epa_site_id drop not null,
  alter column receiving_facility_epa_site_id drop not null,
  alter column receiving_facility_name drop not null;

alter table public.ldr_notices
  add column if not exists source text not null default 'prepared'
    check (source in ('prepared', 'third_party')),
  add column if not exists third_party_name text;
