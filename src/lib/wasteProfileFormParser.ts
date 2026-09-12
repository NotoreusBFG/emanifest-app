import type {
  WasteProfileInput,
  WastewaterCategory,
  ShipmentFrequency,
  PhysicalState,
  WasteCategory,
} from "@/services/wasteProfileRepository";

// Not a "use server" file -- every export in a Server Actions file must be
// an async function, and this is a plain sync parser shared by both
// src/app/actions/wasteProfileActions.ts (manual create/edit) and
// src/app/actions/wizardActions.ts (Wizard save), so it lives here instead.

const WASTE_CATEGORIES: WasteCategory[] = ["hazardous", "non_hazardous", "universal"];

/** Parses an optional numeric form field: blank/missing -> null (not 0 or
 * NaN), so an unset estimate stays genuinely unset rather than looking
 * like a real zero value. */
function parseOptionalNumber(formData: FormData, key: string): number | null {
  const raw = (formData.get(key) as string)?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseWasteProfileFormData(formData: FormData): WasteProfileInput | { error: string } {
  const profileName = ((formData.get("profileName") as string) ?? "").trim();
  if (!profileName) return { error: "Give this profile a name." };

  const wasteCategoryRaw = formData.get("wasteCategory") as string;
  if (!WASTE_CATEGORIES.includes(wasteCategoryRaw as WasteCategory)) {
    return { error: "Choose a waste category." };
  }
  const wasteCategory = wasteCategoryRaw as WasteCategory;

  const generatorEpaId = ((formData.get("generatorEpaId") as string) ?? "").trim().toUpperCase();
  if (!generatorEpaId) {
    return { error: "Select a generator before creating this profile." };
  }
  const generatorName = ((formData.get("generatorName") as string) ?? "").trim();
  const generatorAddress = ((formData.get("generatorAddress") as string) ?? "").trim();

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
    wasteCategory,
    generatorEpaId,
    generatorName,
    generatorAddress,
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
    physicalState: ((formData.get("physicalState") as string) || null) as PhysicalState | null,
    isIgnitable: formData.get("isIgnitable") === "on",
    isCorrosive: formData.get("isCorrosive") === "on",
    isReactive: formData.get("isReactive") === "on",
    isToxic: formData.get("isToxic") === "on",
  };
}
