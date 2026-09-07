"use server";

import { createClient } from "@/lib/supabase/server";
import {
  attachMtnToLdrNotice,
  createLdrNotice,
  createThirdPartyLdrNotice,
  deleteLdrNoticeAttachment,
  findActiveLdrNotice,
  getLdrAttachmentDownloadUrl,
  getLdrNoticeById,
  listLdrNoticeAttachments,
  listLdrNoticesForUser,
  uploadLdrNoticeAttachment,
  type LdrNoticeAttachment,
} from "@/services/ldrRepository";
import { listGeneratorSitesForUser, type GeneratorSiteOption } from "@/services/manifestRepository";
import {
  computeWasteCodeKey,
  type LdrCertification,
  type LdrManagementLetter,
  type LdrNotice,
  type LdrWasteLineEntry,
} from "@/lib/ldr/types";
import { LDR_MANAGEMENT_OPTIONS } from "@/lib/ldr/certificationText";

/** Quick-pick list for the third-party LDR form's generator field -- the
 * distinct sites this user has actually filed/looked up manifests for. */
export async function listGeneratorSitesForUserAction(): Promise<GeneratorSiteOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listGeneratorSitesForUser(supabase, user.id);
}

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
    return { success: false, error: "Select a manifest first — the generator and receiving facility are pulled from it." };
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

export type CreateThirdPartyLdrNoticeState =
  | { success: true; notice: LdrNotice }
  | { success: false; error: string };

/** Third-party path: no waste codes, no certification -- just who sent it
 * and (optionally) which shipment it's for. See createThirdPartyLdrNotice. */
export async function createThirdPartyLdrNoticeAction(
  prevState: CreateThirdPartyLdrNoticeState | null,
  formData: FormData
): Promise<CreateThirdPartyLdrNoticeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const generatorEpaSiteId = (formData.get("generatorEpaSiteId") as string)?.trim();
  const thirdPartyName = (formData.get("thirdPartyName") as string)?.trim();
  const epaMtn = (formData.get("epaMtn") as string)?.trim() || null;

  if (!generatorEpaSiteId) return { success: false, error: "Choose or enter the generator this notice is for." };
  if (!thirdPartyName) return { success: false, error: "Enter who prepared or sent this notice." };

  const result = await createThirdPartyLdrNotice(supabase, user.id, { generatorEpaSiteId, epaMtn, thirdPartyName });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, notice: result.notice };
}

export type AttachMtnState = { success: true } | { success: false; error: string } | null;

/** Backfills the MTN on a notice filed "unattached" (no MTN known yet). */
export async function attachMtnToLdrNoticeAction(
  prevState: AttachMtnState,
  formData: FormData
): Promise<AttachMtnState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const noticeId = formData.get("noticeId") as string;
  const epaMtn = (formData.get("epaMtn") as string)?.trim();
  if (!epaMtn) return { success: false, error: "Enter an MTN." };

  const result = await attachMtnToLdrNotice(supabase, user.id, noticeId, epaMtn);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

export interface LdrAttachmentWithUrl {
  id: string;
  filename: string;
  fileSizeBytes: number | null;
  label: string | null;
  uploadedAt: string;
  url: string | null;
}

/** Resolves a short-lived signed URL per attachment (the bucket is
 * private) -- ownership is enforced by scoping through getLdrNoticeById,
 * which only ever returns notices belonging to the caller. */
export async function listLdrNoticeAttachmentsAction(ldrNoticeId: string): Promise<LdrAttachmentWithUrl[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const notice = await getLdrNoticeById(supabase, user.id, ldrNoticeId);
  if (!notice) return [];

  const attachments = await listLdrNoticeAttachments(supabase, ldrNoticeId);
  return Promise.all(
    attachments.map(async (a) => ({
      id: a.id,
      filename: a.filename,
      fileSizeBytes: a.fileSizeBytes,
      label: a.label,
      uploadedAt: a.uploadedAt,
      url: await getLdrAttachmentDownloadUrl(supabase, a.storagePath),
    }))
  );
}

export type UploadLdrAttachmentState =
  | { success: true; attachment: LdrNoticeAttachment }
  | { success: false; error: string }
  | null;

/**
 * Third-party PDF kept on file alongside an LDR notice (e.g. a lab's LDR
 * determination letter) — see docs comment on uploadLdrNoticeAttachment.
 * Capped by next.config.ts's serverActions.bodySizeLimit (4MB).
 */
export async function uploadLdrNoticeAttachmentAction(
  prevState: UploadLdrAttachmentState,
  formData: FormData
): Promise<UploadLdrAttachmentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const ldrNoticeId = formData.get("ldrNoticeId") as string;
  const label = (formData.get("label") as string) ?? "";
  const file = formData.get("file") as File | null;

  if (!ldrNoticeId) return { success: false, error: "Missing LDR notice." };
  if (!file || file.size === 0) return { success: false, error: "Choose a PDF to upload." };
  if (file.type !== "application/pdf") return { success: false, error: "Only PDF files are supported." };

  const notice = await getLdrNoticeById(supabase, user.id, ldrNoticeId);
  if (!notice) return { success: false, error: "LDR notice not found." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadLdrNoticeAttachment(
    supabase,
    user.id,
    ldrNoticeId,
    { name: file.name, bytes },
    label
  );
  if (!result.success) return { success: false, error: result.error };
  return { success: true, attachment: result.attachment };
}

/** Re-verifies ownership from the DB row itself (not a client-supplied
 * storage path) before deleting anything from Storage. */
export async function deleteLdrNoticeAttachmentAction(
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const { data: row, error: fetchError } = await supabase
    .from("ldr_notice_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError) return { success: false, error: fetchError.message };
  if (!row) return { success: false, error: "Attachment not found." };

  return deleteLdrNoticeAttachment(supabase, attachmentId, row.storage_path);
}
