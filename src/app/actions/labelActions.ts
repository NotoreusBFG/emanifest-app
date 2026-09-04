"use server";

import { createClient } from "@/lib/supabase/server";
import { getWasteProfile } from "@/services/wasteProfileRepository";
import {
  createLabelPrint,
  createLabelPrintsForManifestLine,
  getLabelPrint,
  type LabelPrint,
  type ManifestLineLabelInput,
} from "@/services/labelPrintRepository";

export type CreateLabelPrintState =
  | { success: true; id: string }
  | { success: false; error: string };

/** Snapshots a saved waste profile plus print-time fields (generator info,
 * manifest tracking number, line/container reference, accumulation start
 * date) into a new label_prints row, then the caller navigates to
 * /labels/[id] -- the same page the printed label's QR code points at. */
export async function createLabelPrintAction(formData: FormData): Promise<CreateLabelPrintState> {
  const wasteProfileId = formData.get("wasteProfileId") as string;
  if (!wasteProfileId) return { success: false, error: "Missing waste profile." };

  const accumulationStartDate = (formData.get("accumulationStartDate") as string)?.trim();
  if (!accumulationStartDate) return { success: false, error: "Accumulation start date is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const profile = await getWasteProfile(supabase, user.id, wasteProfileId);
  if (!profile) return { success: false, error: "Waste profile not found." };

  const result = await createLabelPrint(supabase, user.id, profile, {
    generatorName: ((formData.get("generatorName") as string) ?? "").trim(),
    generatorAddress: ((formData.get("generatorAddress") as string) ?? "").trim(),
    generatorEpaId: ((formData.get("generatorEpaId") as string) ?? "").trim(),
    manifestTrackingNumber: ((formData.get("manifestTrackingNumber") as string) ?? "").trim(),
    lineReference: ((formData.get("lineReference") as string) ?? "").trim(),
    accumulationStartDate,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, id: result.labelPrint.id };
}

/** Public -- backs both the owner's post-print redirect and the QR-code
 * scan destination. No auth check: anyone with the link (e.g. a regulator
 * reading a drum) can view it, same as reading the physical label. */
export async function getLabelPrintAction(id: string): Promise<LabelPrint | null> {
  const supabase = await createClient();
  return getLabelPrint(supabase, id);
}

export type GenerateManifestLabelsState = { success: true; ids: string[] } | { success: false; error: string };

/** Called from the manifest creation form right after Save/Save & Sign
 * succeeds -- generates labels straight from the waste lines already
 * sitting in the form's state, profiled or not (see labelPrintRepository's
 * createLabelPrintsForManifestLine for how a freeform line fills in). One
 * accumulation date and label count per line, per the 2026-09-04 decision
 * to keep the print screen at line granularity rather than per copy. */
export async function generateManifestLabelsAction(input: {
  manifestTrackingNumber: string;
  generatorName: string;
  generatorAddress: string;
  generatorEpaId: string;
  disposalFacilityName: string;
  disposalFacilityEpaId: string;
  lines: Array<
    Pick<
      ManifestLineLabelInput,
      | "properShippingName"
      | "wasteDescription"
      | "dotHazardous"
      | "isRcraWaste"
      | "hazardClass"
      | "packingGroup"
      | "idNumberCode"
      | "federalWasteCode"
      | "additionalInfo"
      | "accumulationStartDate"
      | "copies"
    >
  >;
}): Promise<GenerateManifestLabelsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const ids: string[] = [];
  for (const line of input.lines) {
    const result = await createLabelPrintsForManifestLine(supabase, user.id, {
      manifestTrackingNumber: input.manifestTrackingNumber,
      generatorName: input.generatorName,
      generatorAddress: input.generatorAddress,
      generatorEpaId: input.generatorEpaId,
      disposalFacilityName: input.disposalFacilityName,
      disposalFacilityEpaId: input.disposalFacilityEpaId,
      ...line,
    });
    if (!result.success) return { success: false, error: result.error };
    ids.push(...result.labelPrints.map((l) => l.id));
  }
  return { success: true, ids };
}
