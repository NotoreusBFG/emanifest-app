"use server";

import { createClient } from "@/lib/supabase/server";
import { getWasteProfile } from "@/services/wasteProfileRepository";
import { createLabelPrint, getLabelPrint, type LabelPrint } from "@/services/labelPrintRepository";

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
