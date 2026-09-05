import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";
import type { WasteProfile, PhysicalState } from "@/services/wasteProfileRepository";

export interface LabelPrint {
  id: string;
  wasteProfileId: string | null;
  mmProfileNumber: string | null;
  profileName: string;
  properShippingName: string;
  wasteDescription: string;
  dotHazardous: boolean;
  isRcraWaste: boolean;
  hazardClass: string;
  packingGroup: string;
  idNumberCode: string;
  federalWasteCode: string;
  physicalState: PhysicalState | null;
  isIgnitable: boolean;
  isCorrosive: boolean;
  isReactive: boolean;
  isToxic: boolean;
  disposalFacilityName: string;
  disposalFacilityEpaId: string;
  disposalFacilityProfileNumber: string;
  generatorName: string;
  generatorAddress: string;
  generatorEpaId: string;
  manifestTrackingNumber: string;
  lineReference: string;
  /** Null when the container hasn't started accumulating yet -- the
   * physical label's date field is an underlined write-in box, so a
   * blank one is meant to be filled in by hand, not an error state. */
  accumulationStartDate: string | null;
  createdAt: string;
}

export interface LabelPrintPrintTimeInput {
  generatorName: string;
  generatorAddress: string;
  generatorEpaId: string;
  manifestTrackingNumber: string;
  lineReference: string;
  accumulationStartDate: string;
}

function mapRow(row: Record<string, unknown>): LabelPrint {
  return {
    id: row.id as string,
    wasteProfileId: (row.waste_profile_id as string) ?? null,
    mmProfileNumber: (row.mm_profile_number as string) ?? null,
    profileName: row.profile_name as string,
    properShippingName: (row.proper_shipping_name as string) ?? "",
    wasteDescription: (row.waste_description as string) ?? "",
    dotHazardous: !!row.dot_hazardous,
    isRcraWaste: !!row.is_rcra_waste,
    hazardClass: (row.hazard_class as string) ?? "",
    packingGroup: (row.packing_group as string) ?? "",
    idNumberCode: (row.id_number_code as string) ?? "",
    federalWasteCode: (row.federal_waste_code as string) ?? "",
    physicalState: (row.physical_state as PhysicalState | null) ?? null,
    isIgnitable: !!row.is_ignitable,
    isCorrosive: !!row.is_corrosive,
    isReactive: !!row.is_reactive,
    isToxic: !!row.is_toxic,
    disposalFacilityName: (row.disposal_facility_name as string) ?? "",
    disposalFacilityEpaId: (row.disposal_facility_epa_id as string) ?? "",
    disposalFacilityProfileNumber: (row.disposal_facility_profile_number as string) ?? "",
    generatorName: (row.generator_name as string) ?? "",
    generatorAddress: (row.generator_address as string) ?? "",
    generatorEpaId: (row.generator_epa_id as string) ?? "",
    manifestTrackingNumber: (row.manifest_tracking_number as string) ?? "",
    lineReference: (row.line_reference as string) ?? "",
    accumulationStartDate: (row.accumulation_start_date as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Snapshots the profile's characterization fields plus the print-time
 * fields into a new row -- deliberately not a live join to waste_profiles,
 * so a regulator reading this label months from now sees exactly what was
 * printed, even if the profile itself has since been edited. */
export async function createLabelPrint(
  supabase: SupabaseClient,
  userId: string,
  profile: WasteProfile,
  printTime: LabelPrintPrintTimeInput
): Promise<{ success: true; labelPrint: LabelPrint } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("label_prints")
    .insert({
      user_id: userId,
      waste_profile_id: profile.id,
      mm_profile_number: profile.mmProfileNumber,
      profile_name: profile.profileName,
      proper_shipping_name: profile.properShippingName,
      waste_description: profile.wasteDescription,
      dot_hazardous: profile.dotHazardous,
      is_rcra_waste: profile.isRcraWaste,
      hazard_class: profile.hazardClass,
      packing_group: profile.packingGroup,
      id_number_code: profile.idNumberCode,
      federal_waste_code: profile.federalWasteCode,
      physical_state: profile.physicalState,
      is_ignitable: profile.isIgnitable,
      is_corrosive: profile.isCorrosive,
      is_reactive: profile.isReactive,
      is_toxic: profile.isToxic,
      disposal_facility_name: profile.disposalFacilityName,
      disposal_facility_epa_id: profile.disposalFacilityEpaId,
      disposal_facility_profile_number: profile.disposalFacilityProfileNumber,
      generator_name: printTime.generatorName,
      generator_address: printTime.generatorAddress,
      generator_epa_id: printTime.generatorEpaId,
      manifest_tracking_number: printTime.manifestTrackingNumber,
      line_reference: printTime.lineReference,
      accumulation_start_date: printTime.accumulationStartDate,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createLabelPrint failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, labelPrint: mapRow(data) };
}

export interface ProfileBatchPrintTimeInput {
  generatorName: string;
  generatorAddress: string;
  generatorEpaId: string;
  /** Null = leave blank for hand-entry -- see accumulationStartDate's
   * comment on LabelPrint. */
  accumulationStartDate: string | null;
  /** How many labels to generate for this profile (e.g. one per drum). */
  copies: number;
}

/** Batch-prints labels straight from a saved profile ahead of any
 * shipment -- the 2026-09-05 "search a generator, then print labels for
 * their saved profiles" flow. Unlike createLabelPrint (one label, caller
 * types generator info and an optional MTN by hand), this always leaves
 * manifest_tracking_number blank (there's no manifest yet -- that's the
 * point of accumulation-time labeling) and supports multiple copies with
 * the same "N of M" auto-numbering as the manifest/BOL batch flows. */
export async function createLabelPrintsForProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: WasteProfile,
  input: ProfileBatchPrintTimeInput
): Promise<{ success: true; labelPrints: LabelPrint[] } | { success: false; error: string }> {
  const copies = Math.max(1, Math.floor(input.copies));

  const rows = Array.from({ length: copies }, (_, i) => ({
    user_id: userId,
    waste_profile_id: profile.id,
    mm_profile_number: profile.mmProfileNumber,
    profile_name: profile.profileName,
    proper_shipping_name: profile.properShippingName,
    waste_description: profile.wasteDescription,
    dot_hazardous: profile.dotHazardous,
    is_rcra_waste: profile.isRcraWaste,
    hazard_class: profile.hazardClass,
    packing_group: profile.packingGroup,
    id_number_code: profile.idNumberCode,
    federal_waste_code: profile.federalWasteCode,
    physical_state: profile.physicalState,
    is_ignitable: profile.isIgnitable,
    is_corrosive: profile.isCorrosive,
    is_reactive: profile.isReactive,
    is_toxic: profile.isToxic,
    disposal_facility_name: profile.disposalFacilityName,
    disposal_facility_epa_id: profile.disposalFacilityEpaId,
    disposal_facility_profile_number: profile.disposalFacilityProfileNumber,
    generator_name: input.generatorName,
    generator_address: input.generatorAddress,
    generator_epa_id: input.generatorEpaId,
    manifest_tracking_number: "",
    line_reference: `${i + 1} of ${copies}`,
    accumulation_start_date: input.accumulationStartDate,
  }));

  const { data, error } = await supabase.from("label_prints").insert(rows).select("*");

  if (error) {
    console.error("createLabelPrintsForProfile failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, labelPrints: (data ?? []).map(mapRow) };
}

export interface ManifestLineLabelInput {
  manifestTrackingNumber: string;
  generatorName: string;
  generatorAddress: string;
  generatorEpaId: string;
  disposalFacilityName: string;
  disposalFacilityEpaId: string;
  properShippingName: string;
  wasteDescription: string;
  dotHazardous: boolean;
  isRcraWaste: boolean;
  hazardClass: string;
  packingGroup: string;
  idNumberCode: string;
  federalWasteCode: string;
  /** Box 14 special/handling instructions for this specific waste line --
   * prints on line 1 ("Waste Description") per the 2026-09-04 design
   * decision. Not the shipping description (that's line 2, "DOT Shipping
   * Name", from properShippingName/wasteDescription below). */
  additionalInfo: string;
  accumulationStartDate: string;
  /** How many labels to generate for this line (e.g. one drum each). */
  copies: number;
}

/** Generates labels straight from a manifest waste line at shipment time --
 * no saved waste profile required. Fields that only exist on a saved
 * profile (physical state, hazard-property checkboxes, TSDF approval #)
 * are left null/blank, per the 2026-09-04 design decision to fill in
 * everything available and leave the rest blank rather than block
 * printing on having a profile. */
export async function createLabelPrintsForManifestLine(
  supabase: SupabaseClient,
  userId: string,
  input: ManifestLineLabelInput
): Promise<{ success: true; labelPrints: LabelPrint[] } | { success: false; error: string }> {
  const copies = Math.max(1, Math.floor(input.copies));

  const rows = Array.from({ length: copies }, (_, i) => ({
    user_id: userId,
    waste_profile_id: null,
    mm_profile_number: null,
    profile_name: input.additionalInfo,
    proper_shipping_name: input.properShippingName,
    waste_description: input.wasteDescription,
    dot_hazardous: input.dotHazardous,
    is_rcra_waste: input.isRcraWaste,
    hazard_class: input.hazardClass,
    packing_group: input.packingGroup,
    id_number_code: input.idNumberCode,
    federal_waste_code: input.federalWasteCode,
    disposal_facility_name: input.disposalFacilityName,
    disposal_facility_epa_id: input.disposalFacilityEpaId,
    disposal_facility_profile_number: "",
    generator_name: input.generatorName,
    generator_address: input.generatorAddress,
    generator_epa_id: input.generatorEpaId,
    manifest_tracking_number: input.manifestTrackingNumber,
    line_reference: `${i + 1} of ${copies}`,
    accumulation_start_date: input.accumulationStartDate,
  }));

  const { data, error } = await supabase.from("label_prints").insert(rows).select("*");

  if (error) {
    console.error("createLabelPrintsForManifestLine failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, labelPrints: (data ?? []).map(mapRow) };
}

/** Public lookup by id -- no user_id filter, since this backs the
 * QR-code destination page anyone can scan (see the table's RLS policy).
 * Never select user_id here even though RLS itself doesn't hide columns. */
export async function getLabelPrint(supabase: SupabaseClient, id: string): Promise<LabelPrint | null> {
  const { data, error } = await supabase
    .from("label_prints")
    .select(
      "id, waste_profile_id, mm_profile_number, profile_name, proper_shipping_name, waste_description, dot_hazardous, is_rcra_waste, hazard_class, packing_group, id_number_code, federal_waste_code, physical_state, is_ignitable, is_corrosive, is_reactive, is_toxic, disposal_facility_name, disposal_facility_epa_id, disposal_facility_profile_number, generator_name, generator_address, generator_epa_id, manifest_tracking_number, line_reference, accumulation_start_date, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getLabelPrint failed:", describePostgrestError(error));
    return null;
  }
  return data ? mapRow(data) : null;
}
