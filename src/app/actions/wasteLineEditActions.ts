"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { buildWasteLinesFromFormData } from "@/lib/rcrainfo/buildManifestInput";
import { timingSafeCompareCode } from "@/lib/verificationCode";
import { sendSms, SmsNotConfiguredError } from "@/lib/sms/twilioClient";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import { currentOrigin } from "./driverSignActions";
import type { FederalWasteCode } from "@/lib/rcrainfo/types";
import {
  createWasteLineEditToken,
  getWasteLineEditSession,
  claimWasteLineEditToken,
  releaseWasteLineEditToken,
  getManifestMminForWasteLineToken,
  getOwnerCredentialsForWasteLineToken,
  recordManifestEditConsent,
  type WasteLineEditSession,
} from "@/services/wasteLineEditRepository";

function clientFor(credentials: { apiId: string; apiKey: string }) {
  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials,
  });
}

export type CreateWasteLineEditLinkState =
  | { success: true; link: string; smsSent: boolean; emailSent: boolean; smsError?: string; emailError?: string }
  | { success: false; error: string };

/**
 * Owner-facing: invites someone to add/edit ONLY this manifest's waste
 * lines — no ManifestMate account needed, one-time link. Live-fetches the
 * manifest for the display-snapshot names (never trusts a caller-supplied
 * name). The MMIN itself is never put in the SMS/email — the owner reads
 * it off the manifest's own dashboard card and relays it separately, same
 * principle as every other MMIN-gated flow.
 */
export async function createWasteLineEditLinkAction(
  mtn: string,
  recipientPhone: string | null,
  recipientEmail: string | null
): Promise<CreateWasteLineEditLinkState> {
  if (!recipientPhone && !recipientEmail) {
    return { success: false, error: "Enter a phone number and/or an email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const manifest = await client.getManifest(mtn);

    const token = await createWasteLineEditToken(supabase, {
      manifestEpaMtn: manifest.manifestTrackingNumber,
      recipientPhone,
      recipientEmail,
      generatorName: manifest.generator.name || manifest.generator.epaSiteId,
      designatedFacilityName: manifest.designatedFacility.name || manifest.designatedFacility.epaSiteId,
    });

    const origin = await currentOrigin();
    const link = `${origin}/edit-waste-lines/${token}`;
    const message = `ManifestMate: you've been asked to add waste line details to manifest ${manifest.manifestTrackingNumber} — ${link}`;

    let smsSent = false;
    let emailSent = false;
    let smsError: string | undefined;
    let emailError: string | undefined;

    if (recipientPhone) {
      try {
        await sendSms(recipientPhone, message);
        smsSent = true;
      } catch (err) {
        if (!(err instanceof SmsNotConfiguredError)) {
          console.error("Waste-line-edit invite SMS failed (non-fatal, link still valid):", err);
        }
        smsError = err instanceof Error ? err.message : "Unknown SMS error.";
      }
    }

    if (recipientEmail) {
      try {
        await sendEmail(recipientEmail, `Add waste line details to manifest ${manifest.manifestTrackingNumber}`, message);
        emailSent = true;
      } catch (err) {
        if (!(err instanceof EmailNotConfiguredError)) {
          console.error("Waste-line-edit invite email failed (non-fatal, link still valid):", err);
        }
        emailError = err instanceof Error ? err.message : "Unknown email error.";
      }
    }

    return { success: true, link, smsSent, emailSent, smsError, emailError };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type WasteLineEditSessionState =
  | { success: true; session: WasteLineEditSession }
  | { success: false; error: string };

/** Anonymous-facing: loads the display snapshot for the public /edit-waste-lines/[token] page. No waste content — see get_waste_line_edit_session's comment. */
export async function getWasteLineEditSessionAction(token: string): Promise<WasteLineEditSessionState> {
  const supabase = await createClient();
  try {
    const session = await getWasteLineEditSession(supabase, token);
    if (!session) {
      return { success: false, error: "This link is no longer valid — it may be expired or already used." };
    }
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type WasteLineFederalWasteCodeState =
  | { success: true; codes: FederalWasteCode[] }
  | { success: false; error: string };

/**
 * Anonymous-facing, token-gated version of getFederalWasteCodesAction.
 * This is static regulatory reference data (567 codes, rarely changes),
 * not sensitive — but resolving owner credentials to fetch it still
 * requires a CLAIMED token (see getOwnerCredentialsForWasteLineToken), so
 * this only works once the delegate has already entered a correct MMIN —
 * the delegate's waste-line editor only ever renders post-claim (see
 * EditWasteLinesForm.tsx), so that's always true by the time this is
 * called.
 */
let cachedFederalWasteCodesForWasteLineEdit: FederalWasteCode[] | null = null;

export async function getFederalWasteCodesForWasteLineTokenAction(tokenId: string): Promise<WasteLineFederalWasteCodeState> {
  if (cachedFederalWasteCodesForWasteLineEdit) {
    return { success: true, codes: cachedFederalWasteCodesForWasteLineEdit };
  }

  const supabase = await createClient();
  try {
    const credentials = await getOwnerCredentialsForWasteLineToken(supabase, tokenId);
    if (!credentials) return { success: false, error: "This link is no longer valid." };
    const client = clientFor(credentials);
    const codes = await client.getFederalWasteCodes();
    cachedFederalWasteCodesForWasteLineEdit = codes;
    return { success: true, codes };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type SubmitWasteLineEditState =
  | { success: true; wasteLineCount: number }
  | { success: false; error: string }
  | null;

/**
 * Anonymous-facing: the delegate's real submission. Bound via
 * `.bind(null, token)` before being passed to `useActionState`
 * (EditWasteLinesForm.tsx), same pattern `/manifests/new` uses for
 * createManifestAction — `mmin` travels as a plain form field (`name="mmin"`)
 * rather than a separate argument, so the bound signature lines up with
 * what useActionState expects: `(prevState, formData) => ...`.
 *
 * Claims the token, verifies the MMIN (fail closed, same shape as
 * submitGeneratorSignAction), then — only on success — resolves owner
 * credentials, LIVE re-fetches the manifest (never trusts anything
 * client-submitted for generator/transporter/designated-facility, which
 * this form doesn't even collect — see ManifestFieldsForm's
 * mode="wasteLinesOnly"), replaces just `wastes` and appends the
 * delegate's per-line notes onto the EXISTING
 * additionalInfo.handlingInstructions (not rebuilt from scratch — avoids
 * re-deriving or duplicating the owner's original text or any
 * agency-authority certification already baked into that string from
 * creation time), then calls updateManifest() with the full object.
 * Applies directly to EPA once the MMIN is verified — no separate owner
 * review step (confirmed with user).
 */
export async function submitWasteLineEditAction(
  token: string,
  prevState: SubmitWasteLineEditState,
  formData: FormData
): Promise<SubmitWasteLineEditState> {
  const mmin = (formData.get("mmin") as string) ?? "";
  const supabase = await createClient();
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent");

  // Claimed BEFORE the MMIN check and the RCRAInfo call, not after —
  // closes the double-submit race a naive "check then act" sequence would
  // leave open.
  const claimed = await claimWasteLineEditToken(supabase, token);
  if (!claimed) {
    return { success: false, error: "This link is no longer valid — it may be expired or already used." };
  }

  const recordResult = (outcome: { editSucceeded: boolean; epaReportId?: string; epaError?: string }, mminVerified: boolean) =>
    recordManifestEditConsent(supabase, {
      tokenId: claimed.tokenId,
      epaMtn: claimed.epaMtn,
      mminVerified,
      ipAddress,
      userAgent,
      ...outcome,
    });

  // MMIN gate — checked before resolving credentials or making any
  // RCRAInfo call, so a wrong code never spends a real EPA API round trip.
  // Fails CLOSED (not open) when no MMIN is set, same reasoning as
  // submitDriverSignAction/submitGeneratorSignAction's identical gates.
  const actualMmin = await getManifestMminForWasteLineToken(supabase, claimed.tokenId);
  if (actualMmin === null) {
    await releaseWasteLineEditToken(supabase, claimed.tokenId);
    await recordResult({ editSucceeded: false, epaError: "This manifest hasn't been assigned a signing code yet." }, false);
    return {
      success: false,
      error: "This manifest hasn't been assigned a signing code yet — ask the owner to reopen it once, then try again.",
    };
  }
  if (!timingSafeCompareCode(mmin.trim(), actualMmin)) {
    // Increments the EXISTING failed_attempt_count via releaseWasteLineEditToken
    // — same rate-limit convention every other token flow in this app uses.
    await releaseWasteLineEditToken(supabase, claimed.tokenId);
    await recordResult({ editSucceeded: false, epaError: "Incorrect MMIN." }, false);
    return { success: false, error: "Incorrect code — check with whoever sent you this link and try again." };
  }

  try {
    const credentials = await getOwnerCredentialsForWasteLineToken(supabase, claimed.tokenId);
    if (!credentials) {
      await recordResult({ editSucceeded: false, epaError: "Owner credentials unavailable." }, true);
      return { success: false, error: "This link is no longer valid." };
    }

    const wasteResult = buildWasteLinesFromFormData(formData);
    if (wasteResult.error) {
      await recordResult({ editSucceeded: false, epaError: wasteResult.error }, true);
      return { success: false, error: wasteResult.error };
    }

    const client = clientFor(credentials);

    // Live re-fetch — the ONLY source of truth for generator/transporter/
    // designated-facility, which this delegate form never collects at
    // all. updateManifest() requires the full object, so everything else
    // on this live copy is submitted back unchanged.
    const manifest = await client.getManifest(claimed.epaMtn);
    manifest.wastes = wasteResult.wastes;
    if (wasteResult.lineInstructionNotes.length > 0) {
      const existingInstructions = manifest.additionalInfo?.handlingInstructions ?? "";
      const combined = [existingInstructions, ...wasteResult.lineInstructionNotes].filter(Boolean).join(" | ");
      manifest.additionalInfo = { handlingInstructions: combined };
    }

    // A non-2xx response throws (caught below) rather than returning
    // per-entity errors inline — same behavior client.saveManifest()
    // already relies on in createManifestAction, confirmed live (see
    // MANIFEST_SCHEMA.md: error responses are the reliable spec here).
    const result = await client.updateManifest(manifest);

    await recordResult({ editSucceeded: true, epaReportId: result.reportId }, true);
    return { success: true, wasteLineCount: wasteResult.wastes.length };
  } catch (err) {
    const errorMessage = formatRcrainfoError(err);
    await recordResult({ editSucceeded: false, epaError: errorMessage }, true);
    return { success: false, error: errorMessage };
  }
}
