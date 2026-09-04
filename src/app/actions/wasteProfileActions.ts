"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createWasteProfile,
  listWasteProfilesForUser,
  updateWasteProfile,
  deleteWasteProfile,
  type WasteProfile,
  type WasteProfileInput,
  type WastewaterCategory,
  type ShipmentFrequency,
} from "@/services/wasteProfileRepository";

/** Parses an optional numeric form field: blank/missing -> null (not 0 or
 * NaN), so an unset estimate stays genuinely unset rather than looking
 * like a real zero value. */
function parseOptionalNumber(formData: FormData, key: string): number | null {
  const raw = (formData.get(key) as string)?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type WasteProfileActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

function parseWasteProfileFormData(formData: FormData): WasteProfileInput | { error: string } {
  const profileName = ((formData.get("profileName") as string) ?? "").trim();
  if (!profileName) return { error: "Give this profile a name." };

  // Uppercased/trimmed so the load-a-profile match check in
  // ManifestFieldsForm.tsx can compare it directly against the manifest
  // facility's EPA ID without worrying about case/whitespace mismatches.
  const disposalFacilityEpaId = ((formData.get("disposalFacilityEpaId") as string) ?? "").trim().toUpperCase();
  if (!disposalFacilityEpaId) {
    return {
      error:
        "The disposal facility's EPA ID is required, so ManifestMate can refuse to load this profile onto a manifest bound for a different facility.",
    };
  }

  const dotHazardous = formData.get("dotHazardous") === "on";
  const properShippingName = ((formData.get("properShippingName") as string) ?? "").trim();
  const wasteDescription = ((formData.get("wasteDescription") as string) ?? "").trim();
  if (dotHazardous && !properShippingName) {
    return { error: "Enter a proper shipping name (or uncheck DOT hazardous and enter a waste description instead)." };
  }
  if (!dotHazardous && !wasteDescription) {
    return { error: "Enter a waste description." };
  }

  return {
    profileName,
    dotHazardous,
    isRcraWaste: formData.get("isRcraWaste") === "on",
    properShippingName,
    rqIndicator: formData.get("rqIndicator") === "on",
    hazardClass: ((formData.get("hazardClass") as string) ?? "").trim(),
    packingGroup: ((formData.get("packingGroup") as string) ?? "").trim(),
    idNumberCode: ((formData.get("idNumberCode") as string) ?? "").trim(),
    federalWasteCode: ((formData.get("federalWasteCode") as string) ?? "").trim(),
    wastewaterCategory: ((formData.get("wastewaterCategory") as string) || "nonwastewater") as WastewaterCategory,
    isLabPack: formData.get("isLabPack") === "on",
    wasteDescription,
    defaultUnitCode: ((formData.get("defaultUnitCode") as string) ?? "").trim(),
    defaultContainerTypeCode: ((formData.get("defaultContainerTypeCode") as string) ?? "").trim(),
    disposalFacilityName: ((formData.get("disposalFacilityName") as string) ?? "").trim(),
    disposalFacilityEpaId,
    disposalFacilityProfileNumber: ((formData.get("disposalFacilityProfileNumber") as string) ?? "").trim(),
    estimatedContainerCount: parseOptionalNumber(formData, "estimatedContainerCount"),
    estimatedQuantity: parseOptionalNumber(formData, "estimatedQuantity"),
    shipmentFrequency: ((formData.get("shipmentFrequency") as string) || null) as ShipmentFrequency | null,
    shipmentFrequencyOther: ((formData.get("shipmentFrequencyOther") as string) ?? "").trim(),
    specificGravity: parseOptionalNumber(formData, "specificGravity"),
  };
}

export async function createWasteProfileAction(
  prevState: WasteProfileActionState,
  formData: FormData
): Promise<WasteProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const parsed = parseWasteProfileFormData(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const result = await createWasteProfile(supabase, user.id, parsed);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/profiles");
  return { success: true, message: `Saved as ${result.profile.mmProfileNumber}.` };
}

export async function updateWasteProfileAction(
  prevState: WasteProfileActionState,
  formData: FormData
): Promise<WasteProfileActionState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "Missing profile id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const parsed = parseWasteProfileFormData(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const result = await updateWasteProfile(supabase, user.id, id, parsed);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/profiles");
  return { success: true, message: "Profile updated." };
}

export async function deleteWasteProfileAction(id: string): Promise<WasteProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await deleteWasteProfile(supabase, user.id, id);
  if (!result.success) return { success: false, error: result.error ?? "Failed to delete." };

  revalidatePath("/profiles");
  return { success: true, message: "Profile deleted." };
}

export async function listWasteProfilesForUserAction(): Promise<WasteProfile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listWasteProfilesForUser(supabase, user.id);
}
