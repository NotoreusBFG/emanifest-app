import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";
import type { WasteProfile, PhysicalState } from "@/services/wasteProfileRepository";

export interface LabelPrint {
  id: string;
  wasteProfileId: string | null;
  mmProfileNumber: string;
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
  accumulationStartDate: string;
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
    mmProfileNumber: row.mm_profile_number as string,
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
    accumulationStartDate: row.accumulation_start_date as string,
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
