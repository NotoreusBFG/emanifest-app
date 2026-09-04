import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export type WastewaterCategory = "wastewater" | "nonwastewater";
export type ShipmentFrequency = "one_time" | "monthly" | "quarterly" | "biannual" | "annual" | "other";

export interface WasteProfile {
  id: string;
  mmProfileNumber: string;
  profileName: string;
  dotHazardous: boolean;
  isRcraWaste: boolean;
  properShippingName: string;
  rqIndicator: boolean;
  hazardClass: string;
  packingGroup: string;
  idNumberCode: string;
  federalWasteCode: string;
  wastewaterCategory: WastewaterCategory;
  isLabPack: boolean;
  wasteDescription: string;
  defaultUnitCode: string;
  defaultContainerTypeCode: string;
  disposalFacilityName: string;
  disposalFacilityEpaId: string;
  disposalFacilityProfileNumber: string;
  // LQG biennial-report-prep fields -- an expected shipment size/cadence,
  // not anything submitted to EPA on the manifest itself.
  estimatedContainerCount: number | null;
  estimatedQuantity: number | null;
  shipmentFrequency: ShipmentFrequency | null;
  shipmentFrequencyOther: string;
  specificGravity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WasteProfileInput {
  profileName: string;
  dotHazardous: boolean;
  isRcraWaste: boolean;
  properShippingName: string;
  rqIndicator: boolean;
  hazardClass: string;
  packingGroup: string;
  idNumberCode: string;
  federalWasteCode: string;
  wastewaterCategory: WastewaterCategory;
  isLabPack: boolean;
  wasteDescription: string;
  defaultUnitCode: string;
  defaultContainerTypeCode: string;
  disposalFacilityName: string;
  disposalFacilityEpaId: string;
  disposalFacilityProfileNumber: string;
  estimatedContainerCount: number | null;
  estimatedQuantity: number | null;
  shipmentFrequency: ShipmentFrequency | null;
  shipmentFrequencyOther: string;
  specificGravity: number | null;
}

function mapRow(row: Record<string, unknown>): WasteProfile {
  return {
    id: row.id as string,
    mmProfileNumber: row.mm_profile_number as string,
    profileName: row.profile_name as string,
    dotHazardous: !!row.dot_hazardous,
    isRcraWaste: !!row.is_rcra_waste,
    properShippingName: (row.proper_shipping_name as string) ?? "",
    rqIndicator: !!row.rq_indicator,
    hazardClass: (row.hazard_class as string) ?? "",
    packingGroup: (row.packing_group as string) ?? "",
    idNumberCode: (row.id_number_code as string) ?? "",
    federalWasteCode: (row.federal_waste_code as string) ?? "",
    wastewaterCategory: row.wastewater_category as WastewaterCategory,
    isLabPack: !!row.is_lab_pack,
    wasteDescription: (row.waste_description as string) ?? "",
    defaultUnitCode: (row.default_unit_code as string) ?? "",
    defaultContainerTypeCode: (row.default_container_type_code as string) ?? "",
    disposalFacilityName: (row.disposal_facility_name as string) ?? "",
    disposalFacilityEpaId: (row.disposal_facility_epa_id as string) ?? "",
    disposalFacilityProfileNumber: (row.disposal_facility_profile_number as string) ?? "",
    estimatedContainerCount: (row.estimated_container_count as number | null) ?? null,
    estimatedQuantity: (row.estimated_quantity as number | null) ?? null,
    shipmentFrequency: (row.shipment_frequency as ShipmentFrequency | null) ?? null,
    shipmentFrequencyOther: (row.shipment_frequency_other as string) ?? "",
    specificGravity: (row.specific_gravity as number | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toRow(input: WasteProfileInput) {
  return {
    profile_name: input.profileName,
    dot_hazardous: input.dotHazardous,
    is_rcra_waste: input.isRcraWaste,
    proper_shipping_name: input.properShippingName,
    rq_indicator: input.rqIndicator,
    hazard_class: input.hazardClass,
    packing_group: input.packingGroup,
    id_number_code: input.idNumberCode,
    federal_waste_code: input.federalWasteCode,
    wastewater_category: input.wastewaterCategory,
    is_lab_pack: input.isLabPack,
    waste_description: input.wasteDescription,
    default_unit_code: input.defaultUnitCode,
    default_container_type_code: input.defaultContainerTypeCode,
    disposal_facility_name: input.disposalFacilityName,
    disposal_facility_epa_id: input.disposalFacilityEpaId,
    disposal_facility_profile_number: input.disposalFacilityProfileNumber,
    estimated_container_count: input.estimatedContainerCount,
    estimated_quantity: input.estimatedQuantity,
    shipment_frequency: input.shipmentFrequency,
    shipment_frequency_other: input.shipmentFrequencyOther,
    specific_gravity: input.specificGravity,
  };
}

export async function createWasteProfile(
  supabase: SupabaseClient,
  userId: string,
  input: WasteProfileInput
): Promise<{ success: true; profile: WasteProfile } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("waste_profiles")
    .insert({ user_id: userId, ...toRow(input) })
    .select("*")
    .single();

  if (error) {
    console.error("createWasteProfile failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, profile: mapRow(data) };
}

export async function listWasteProfilesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<WasteProfile[]> {
  const { data, error } = await supabase
    .from("waste_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listWasteProfilesForUser failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function updateWasteProfile(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: WasteProfileInput
): Promise<{ success: true; profile: WasteProfile } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("waste_profiles")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    console.error("updateWasteProfile failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, profile: mapRow(data) };
}

export async function deleteWasteProfile(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("waste_profiles").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("deleteWasteProfile failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}
