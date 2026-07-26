"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createLdrNotice,
  findActiveLdrNotice,
  listLdrNoticesForUser,
} from "@/services/ldrRepository";
import {
  computeWasteCodeKey,
  type LdrCertification,
  type LdrManagementLetter,
  type LdrNotice,
  type LdrWasteLineEntry,
} from "@/lib/ldr/types";
import { LDR_MANAGEMENT_OPTIONS } from "@/lib/ldr/certificationText";

export async function listLdrNoticesAction(): Promise<LdrNotice[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listLdrNoticesForUser(supabase, user.id);
}

/**
 * The "do we already have an active notice on file" check central to
 * this feature's one-time-notice model (ldr schema.md §5) — called from
 * the create-notice form as soon as generator/facility/waste codes are
 * known, so the user sees whether a new notice is actually needed before
 * filling out the rest of the form.
 */
export async function findActiveLdrNoticeAction(
  generatorEpaSiteId: string,
  receivingFacilityEpaSiteId: string,
  wasteLines: LdrWasteLineEntry[]
): Promise<LdrNotice | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const wasteCodeKey = computeWasteCodeKey(wasteLines);
  if (!wasteCodeKey) return null;
  return findActiveLdrNotice(supabase, user.id, generatorEpaSiteId, receivingFacilityEpaSiteId, wasteCodeKey);
}

export type CreateLdrNoticeState =
  | { success: true; notice: LdrNotice }
  | { success: false; error: string };

/**
 * Builds one LdrCertification per distinct letter (among the submitted
 * waste lines) that actually requires one — a notice can need several at
 * once, e.g. one line as letter D and another as letter E. Validates every
 * such letter has a non-empty typed signature before returning; snapshots
 * heading/text from LDR_MANAGEMENT_OPTIONS rather than trusting anything
 * client-supplied, same reasoning as the manifest sign-confirmation
 * clickwrap's certificationTextFor().
 */
function buildCertifications(
  wasteLines: LdrWasteLineEntry[],
  signaturesByLetter: Record<string, string>
): { success: true; certifications: LdrCertification[] } | { success: false; error: string } {
  const lettersNeedingCert = new Set<LdrManagementLetter>();
  for (const line of wasteLines) {
    if (LDR_MANAGEMENT_OPTIONS[line.howManaged]?.requiresCertification) {
      lettersNeedingCert.add(line.howManaged);
    }
  }

  const certifications: LdrCertification[] = [];
  const signedAt = new Date().toISOString();
  for (const letter of lettersNeedingCert) {
    const signedByName = signaturesByLetter[letter]?.trim();
    if (!signedByName) {
      return {
        success: false,
        error: `Letter ${letter} (${LDR_MANAGEMENT_OPTIONS[letter].heading}) requires a typed signature name.`,
      };
    }
    const option = LDR_MANAGEMENT_OPTIONS[letter];
    certifications.push({
      letter,
      heading: option.heading,
      certificationText: option.text,
      signedByName,
      signedAt,
    });
  }

  return { success: true, certifications };
}

export async function createLdrNoticeAction(
  prevState: CreateLdrNoticeState | null,
  formData: FormData
): Promise<CreateLdrNoticeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const generatorEpaSiteId = (formData.get("generatorEpaSiteId") as string)?.trim();
  const receivingFacilityEpaSiteId = (formData.get("receivingFacilityEpaSiteId") as string)?.trim();
  const receivingFacilityName = (formData.get("receivingFacilityName") as string)?.trim();
  const preparedByName = (formData.get("preparedByName") as string)?.trim();
  const manifestId = (formData.get("manifestId") as string) || null;
  const epaMtn = (formData.get("epaMtn") as string) || null;
  const supersedePrevious = formData.get("supersedePrevious") === "true";

  let wasteLines: LdrWasteLineEntry[];
  try {
    wasteLines = JSON.parse((formData.get("wasteLinesJson") as string) ?? "[]");
  } catch {
    return { success: false, error: "Invalid waste line data." };
  }

  let signaturesByLetter: Record<string, string>;
  try {
    signaturesByLetter = JSON.parse((formData.get("certificationSignaturesJson") as string) ?? "{}");
  } catch {
    return { success: false, error: "Invalid certification signature data." };
  }

  if (!generatorEpaSiteId || !receivingFacilityEpaSiteId || !receivingFacilityName) {
    return { success: false, error: "Generator and receiving facility are required." };
  }
  if (!preparedByName) {
    return { success: false, error: "A printed name is required to complete this notice." };
  }
  if (wasteLines.length === 0 || wasteLines.every((l) => l.epaHazardousWasteNumbers.length === 0)) {
    return { success: false, error: "At least one EPA hazardous waste code is required." };
  }

  const certResult = buildCertifications(wasteLines, signaturesByLetter);
  if (!certResult.success) return { success: false, error: certResult.error };

  const result = await createLdrNotice(supabase, user.id, {
    manifestId,
    epaMtn,
    generatorEpaSiteId,
    receivingFacilityEpaSiteId,
    receivingFacilityName,
    preparedByName,
    wasteLines,
    certifications: certResult.certifications,
    supersedePrevious,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, notice: result.notice };
}
