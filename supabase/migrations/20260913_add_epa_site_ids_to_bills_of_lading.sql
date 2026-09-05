-- Shipper/consignee/carrier can now be resolved from a live EPA site
-- search (same SiteSearchField the real manifest form uses) rather than
-- only free text -- captures the confirmed EPA Site ID when that
-- happens, so it can print on the document and populate a generated
-- label's EPA ID field, same as a real manifest's generator/facility.
-- Still free text underneath, since a non-hazardous shipment's
-- shipper/consignee/carrier may not be an EPA-registered site at all.
alter table bills_of_lading
  add column if not exists shipper_epa_id text not null default '',
  add column if not exists consignee_epa_id text not null default '',
  add column if not exists carrier_epa_id text not null default '';
