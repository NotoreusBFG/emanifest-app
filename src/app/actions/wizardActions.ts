"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectiveUserId } from "@/services/teamRepository";
import { getAccountType } from "@/services/profileRepository";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { createWasteProfile, type WasteProfile } from "@/services/wasteProfileRepository";
import {
  uploadWasteProfileDocument,
  listWasteProfileDocumentsForUser,
  getWasteProfileDocumentDownloadUrl,
} from "@/services/wasteProfileDocumentRepository";
import { parseWasteProfileFormData } from "@/lib/wasteProfileFormParser";
import { extractWasteProfileFromPdf, type WizardExtractedProfile } from "@/lib/ai/wizardExtraction";
import { AiGatewayNotConfiguredError } from "@/lib/ai/claudeClient";
import { getRcrainfoClientForAction } from "@/services/manifestService";

/** Which flag key gates the Wizard for a given account type -- feature_flags
 * has no per-audience column, so this is two separate all-or-nothing flags
 * (see 2026092101_add_manifestmate_wizard_flags.sql). Every account type
 * other than third_party uses the generator flag; there's no disposal/
 * transporter Wizard surface today. */
function wizardFlagKeyFor(accountType: string): string {
  return accountType === "third_party" ? "manifestmate_wizard_third_party" : "manifestmate_wizard_generator";
}

export async function isWizardEnabledForMeAction(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const accountType = await getAccountType(supabase, user.id);
  return getFeatureFlag(supabase, wizardFlagKeyFor(accountType));
}

export type ExtractWasteProfileState =
  | { success: true; extracted: WizardExtractedProfile }
  | { success: false; error: string };

const MAX_FILE_BYTES = 4 * 1024 * 1024; // matches next.config.ts's serverActions.bodySizeLimit

/**
 * Reads one uploaded PDF and returns a confidence-flagged draft -- persists
 * nothing. The human reviews (and can edit) every field before
 * saveWizardWasteProfileAction actually writes anything, same
 * review-before-save shape as every other AI-adjacent feature in this app.
 */
export async function extractWasteProfileDocumentAction(formData: FormData): Promise<ExtractWasteProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Choose a PDF to upload." };
  if (file.type !== "application/pdf") return { success: false, error: "Only PDF files are supported." };
  if (file.size > MAX_FILE_BYTES) return { success: false, error: "PDF is larger than 4MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfBase64 = Buffer.from(bytes).toString("base64");

  let extracted: WizardExtractedProfile;
  try {
    extracted = await extractWasteProfileFromPdf(pdfBase64);
  } catch (err) {
    if (err instanceof AiGatewayNotConfiguredError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: err instanceof Error ? err.message : "Extraction failed." };
  }

  // Cross-check the extracted disposal facility against a live RCRAInfo
  // lookup, same building block SiteSearchField/LockedGeneratorSelect use
  // (getSiteDetailsAction) -- upgrades confidence when it resolves,
  // downgrades to "inferred" when it doesn't, rather than trusting
  // Claude's reading of the facility name/ID on its own.
  const epaId = extracted.disposalFacilityEpaId.value.trim().toUpperCase();
  if (epaId) {
    try {
      const { client } = await getRcrainfoClientForAction(supabase, user.id);
      const site = await client.getSiteDetails(epaId);
      extracted = {
        ...extracted,
        disposalFacilityEpaId: { value: epaId, confidence: "confident" },
        disposalFacilityName: { value: site.name, confidence: "confident" },
      };
    } catch {
      extracted = {
        ...extracted,
        disposalFacilityEpaId: { value: epaId, confidence: "inferred" },
      };
    }
  }

  return { success: true, extracted };
}

/**
 * One signed download URL per waste profile that has a Wizard-attached
 * source document, keyed by profile id -- the dashboard uses this to show
 * a "View source document" link on the profiles it applies to, without a
 * separate round trip per card. Short-lived (matches
 * getWasteProfileDocumentDownloadUrl's 600s), so this is meant to be
 * re-fetched on each dashboard load, not cached client-side.
 */
export async function listMyWasteProfileDocumentUrlsAction(): Promise<Record<string, { filename: string; url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const documents = await listWasteProfileDocumentsForUser(supabase, effectiveUserId);

  const entries = await Promise.all(
    Array.from(documents.entries()).map(async ([profileId, doc]) => {
      const url = await getWasteProfileDocumentDownloadUrl(supabase, doc.storagePath);
      return url ? ([profileId, { filename: doc.filename, url }] as const) : null;
    })
  );

  return Object.fromEntries(entries.filter((e): e is readonly [string, { filename: string; url: string }] => e !== null));
}

export type SaveWizardProfileState =
  | { success: true; profile: WasteProfile }
  | { success: false; error: string };

/**
 * Saves one reviewed (possibly human-edited) profile from the Wizard queue
 * and attaches its source PDF. Takes FormData, reusing
 * parseWasteProfileFormData verbatim -- the shared form component's fields
 * are mostly uncontrolled inputs, so keeping the same FormData contract
 * the manual create/edit actions use avoids a parallel structured-object
 * path that the form would have to be rebuilt around.
 */
export async function saveWizardWasteProfileAction(formData: FormData): Promise<SaveWizardProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const parsed = parseWasteProfileFormData(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Missing source document." };
  if (file.size > MAX_FILE_BYTES) return { success: false, error: "PDF is larger than 4MB." };

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await createWasteProfile(supabase, effectiveUserId, parsed);
  if (!result.success) return { success: false, error: result.error };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadResult = await uploadWasteProfileDocument(supabase, effectiveUserId, result.profile.id, {
    name: file.name,
    bytes,
  });
  if (!uploadResult.success) {
    // The profile itself saved fine -- losing the attachment isn't worth
    // failing the whole save over, but it's worth knowing about server-side.
    console.error("saveWizardWasteProfileAction: document attach failed:", uploadResult.error);
  }

  revalidatePath("/profiles");
  return { success: true, profile: result.profile };
}
