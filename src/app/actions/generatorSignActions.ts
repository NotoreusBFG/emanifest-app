"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { getEpaCredentials } from "@/services/epaService";
import { sendSms, SmsNotConfiguredError } from "@/lib/sms/twilioClient";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";
import { currentOrigin } from "./driverSignActions";
import {
  createGeneratorSignToken,
  getGeneratorSignSession,
  claimGeneratorSignToken,
  releaseGeneratorSignToken,
  getOwnerCredentialsForToken,
  recordGeneratorSignResult,
  updateManifestGeneratorSignedAt,
  type GeneratorSignSession,
} from "@/services/generatorSignRepository";
import type { Manifest } from "@/lib/rcrainfo/types";

function clientFor(credentials: { apiId: string; apiKey: string }) {
  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials,
  });
}

export type CreateGeneratorSignLinkState =
  | { success: true; link: string; smsSent: boolean; emailSent: boolean; smsError?: string; emailError?: string }
  | { success: false; error: string };

/**
 * Owner-facing: invites someone to sign the Generator role on `manifest`
 * using the OWNER'S OWN RCRAInfo credentials, via SMS and/or email, no
 * ManifestMate account needed by the recipient. Requires at least one of
 * recipientPhone/recipientEmail (also enforced at the DB level via a
 * check constraint). Creates exactly one token regardless of how many
 * channels are used — both notify about the same signing opportunity,
 * not separate ones.
 */
export async function createGeneratorSignLinkAction(
  manifest: Manifest,
  recipientPhone: string | null,
  recipientEmail: string | null
): Promise<CreateGeneratorSignLinkState> {
  if (!recipientPhone && !recipientEmail) {
    return { success: false, error: "Enter a phone number and/or an email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    // App-layer check (not embedded in SQL) — matches how
    // createDriverSignLinkAction checks transporter existence before
    // creating a token, rather than inside the SECURITY DEFINER function.
    const ownCredentials = await getEpaCredentials(supabase, user.id);
    if (!ownCredentials) {
      return { success: false, error: "Save your RCRAInfo API credentials in Settings first." };
    }

    const wasteLineSummary =
      manifest.wastes
        ?.map((w) => w.wasteDescription)
        .filter(Boolean)
        .join("; ") || null;

    const token = await createGeneratorSignToken(supabase, {
      manifestEpaMtn: manifest.manifestTrackingNumber,
      recipientPhone,
      recipientEmail,
      generatorName: manifest.generator.name || manifest.generator.epaSiteId,
      tsdfName: manifest.designatedFacility.name || manifest.designatedFacility.epaSiteId,
      wasteLineSummary,
    });

    const origin = await currentOrigin();
    const link = `${origin}/sign-generator/${token}`;
    const message = `ManifestMate: review and sign manifest ${manifest.manifestTrackingNumber} as the generator — ${link}`;

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
          console.error("Generator-sign SMS failed (non-fatal, link still valid):", err);
        }
        smsError = err instanceof Error ? err.message : "Unknown SMS error.";
      }
    }

    if (recipientEmail) {
      try {
        await sendEmail(recipientEmail, `Manifest ${manifest.manifestTrackingNumber} needs your signature`, message);
        emailSent = true;
      } catch (err) {
        if (!(err instanceof EmailNotConfiguredError)) {
          console.error("Generator-sign email failed (non-fatal, link still valid):", err);
        }
        emailError = err instanceof Error ? err.message : "Unknown email error.";
      }
    }

    return { success: true, link, smsSent, emailSent, smsError, emailError };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type GeneratorSignSessionState =
  | { success: true; session: GeneratorSignSession }
  | { success: false; error: string };

/** Anonymous-facing: loads the display snapshot for the public /sign-generator/[token] page. */
export async function getGeneratorSignSessionAction(token: string): Promise<GeneratorSignSessionState> {
  const supabase = await createClient();
  try {
    const session = await getGeneratorSignSession(supabase, token);
    if (!session) {
      return { success: false, error: "This link is no longer valid — it may be expired or already used." };
    }
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export interface SubmitGeneratorSignParams {
  token: string;
  signerName: string;
}

export type SubmitGeneratorSignState =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Anonymous-facing: the actual signature. Sequence mirrors
 * submitDriverSignAction as closely as this different credential source
 * allows — live re-fetch of the manifest and server-recomputed
 * certification text (never trusted from the client or the token's
 * display snapshot), and consent always recorded, success or failure.
 */
export async function submitGeneratorSignAction(
  params: SubmitGeneratorSignParams
): Promise<SubmitGeneratorSignState> {
  if (!params.signerName.trim()) {
    return { success: false, error: "Your name is required." };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent");

  // Claimed BEFORE the RCRAInfo call, not after — closes the double-submit
  // race a naive "check then act" sequence would leave open.
  const claimed = await claimGeneratorSignToken(supabase, params.token);
  if (!claimed) {
    return { success: false, error: "This link is no longer valid — it may be expired or already used." };
  }

  const certification = certificationTextFor("Generator");

  const recordResult = (outcome: { signSucceeded: boolean; epaReportId?: string; epaError?: string }, siteId: string) =>
    recordGeneratorSignResult(supabase, {
      tokenId: claimed.tokenId,
      epaMtn: claimed.epaMtn,
      siteId,
      signerName: params.signerName.trim(),
      certificationHeading: certification.heading,
      certificationText: certification.paragraphs.join("\n\n"),
      certificationIsVerbatim: certification.isVerbatim,
      ipAddress,
      userAgent,
      ...outcome,
    });

  try {
    const credentials = await getOwnerCredentialsForToken(supabase, claimed.tokenId);
    if (!credentials) {
      await releaseGeneratorSignToken(supabase, claimed.tokenId);
      await recordResult({ signSucceeded: false, epaError: "Owner credentials unavailable." }, "");
      return { success: false, error: "This signing link is no longer valid." };
    }

    const client = clientFor(credentials);

    // Live re-fetch — never trust the token's snapshot for the actual
    // signature, and derive siteId from the FRESH manifest's own
    // generator.epaSiteId — user_credentials has no site-id column at
    // all, and the token's snapshot is display-only.
    const freshManifest = await client.getManifest(claimed.epaMtn);
    const siteId = freshManifest.generator.epaSiteId;

    const result = await client.signManifest({
      siteId,
      siteType: "Generator",
      printedSignatureName: params.signerName.trim(),
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [claimed.epaMtn],
    });

    const report = result.manifestReports[0];
    if (report?.manifestError) {
      await releaseGeneratorSignToken(supabase, claimed.tokenId);
      await recordResult({ signSucceeded: false, epaError: report.manifestError.message }, siteId);
      return { success: false, error: report.manifestError.message };
    }

    await recordResult({ signSucceeded: true, epaReportId: result.reportId }, siteId);
    await updateManifestGeneratorSignedAt(
      supabase,
      claimed.ownerUserId,
      claimed.epaMtn,
      new Date().toISOString()
    );

    // Best-effort confirmation over every channel that was actually used
    // at link-creation time (returned directly by claimGeneratorSignToken
    // — generator_sign_tokens has zero RLS policies, so a direct table
    // query here would silently return nothing for this anonymous
    // caller) — not "whichever channel they signed through," since
    // there's no such signal. Signing already succeeded regardless of
    // whether this send works.
    const confirmationMessage = `ManifestMate: Manifest ${claimed.epaMtn} signed as Generator by ${params.signerName.trim()} on ${new Date().toLocaleDateString("en-US")}.`;

    if (claimed.recipientPhone) {
      try {
        await sendSms(claimed.recipientPhone, confirmationMessage);
      } catch (err) {
        console.error("Post-sign generator confirmation SMS failed (non-fatal):", err);
      }
    }
    if (claimed.recipientEmail) {
      try {
        await sendEmail(claimed.recipientEmail, `Manifest ${claimed.epaMtn} signed`, confirmationMessage);
      } catch (err) {
        console.error("Post-sign generator confirmation email failed (non-fatal):", err);
      }
    }

    return {
      success: true,
      message: report?.manifestSigned?.message ?? "Signed — thank you.",
    };
  } catch (err) {
    const errorMessage = formatRcrainfoError(err);
    await releaseGeneratorSignToken(supabase, claimed.tokenId);
    await recordResult({ signSucceeded: false, epaError: errorMessage }, "");
    return { success: false, error: errorMessage };
  }
}
