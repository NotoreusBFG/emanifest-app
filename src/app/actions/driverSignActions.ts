"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { sendSms, SmsNotConfiguredError } from "@/lib/sms/twilioClient";
import { getTransporterForGenerator } from "@/services/transporterRepository";
import {
  createDriverSignToken,
  getDriverSignSession,
  claimDriverSignToken,
  releaseDriverSignToken,
  getTransporterCredentials,
  recordDriverSignResult,
  updateManifestTransporterSignedAt,
  type DriverSignSession,
} from "@/services/driverSignRepository";
import type { Manifest } from "@/lib/rcrainfo/types";

function clientFor(credentials: { apiId: string; apiKey: string }) {
  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials,
  });
}

/** Exported for reuse by generatorSignActions.ts, which needs the same origin-from-headers derivation for its own share links. */
export async function currentOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export type CreateDriverSignLinkState =
  | { success: true; link: string; smsSent: boolean; smsError?: string }
  | { success: false; error: string };

/**
 * Generator-facing: picks a transporter already listed as a handler on
 * `manifest` at `transporterOrder` (the caller passes the already-loaded
 * manifest, same one the generator is looking at — no extra live fetch
 * needed here since the manifest detail page already has a fresh one).
 * Only transporters already in the `transporters` table (admin-provisioned
 * in Phase 1 — see scripts/add-transporter-credentials.ts) can be picked;
 * see getTransporterForGenerator.
 */
export async function createDriverSignLinkAction(
  manifest: Manifest,
  transporterOrder: number,
  driverPhone: string
): Promise<CreateDriverSignLinkState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const transporter = manifest.transporters.find((t) => (t.order ?? 0) === transporterOrder);
  if (!transporter) return { success: false, error: "That transporter isn't on this manifest." };

  try {
    const onFile = await getTransporterForGenerator(supabase, transporter.epaSiteId);
    if (!onFile) {
      return {
        success: false,
        error: `${transporter.name || transporter.epaSiteId} isn't set up for SMS signing yet.`,
      };
    }

    const wasteLineSummary =
      manifest.wastes
        ?.map((w) => w.wasteDescription)
        .filter(Boolean)
        .join("; ") || null;

    const token = await createDriverSignToken(supabase, {
      manifestEpaMtn: manifest.manifestTrackingNumber,
      transporterId: onFile.id,
      transporterOrder,
      generatorName: manifest.generator.name || manifest.generator.epaSiteId,
      tsdfName: manifest.designatedFacility.name || manifest.designatedFacility.epaSiteId,
      wasteLineSummary,
      driverPhone,
    });

    const origin = await currentOrigin();
    const link = `${origin}/sign/${token}`;
    const message = `ManifestMate: review and sign manifest ${manifest.manifestTrackingNumber} as ${onFile.companyName} — ${link}`;

    try {
      await sendSms(driverPhone, message);
      return { success: true, link, smsSent: true };
    } catch (smsErr) {
      // The link itself was created successfully regardless of whether the
      // text went out — SmsNotConfiguredError especially is an expected,
      // handled case (no Twilio account set up yet), not a hard failure —
      // hand the link back either way so the UI can fall back to a manual
      // share. smsError carries the REAL reason (bad phone format, Twilio
      // rejection, etc.) rather than a blanket "isn't configured" message
      // that was misleading for every other failure mode.
      if (!(smsErr instanceof SmsNotConfiguredError)) {
        console.error("SMS send failed (non-fatal, link still valid):", smsErr);
      }
      return {
        success: true,
        link,
        smsSent: false,
        smsError: smsErr instanceof Error ? smsErr.message : "Unknown SMS error.",
      };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type DriverSignSessionState =
  | { success: true; session: DriverSignSession }
  | { success: false; error: string };

/** Anonymous-facing: loads the display snapshot for the public /sign/[token] page. */
export async function getDriverSignSessionAction(token: string): Promise<DriverSignSessionState> {
  const supabase = await createClient();
  try {
    const session = await getDriverSignSession(supabase, token);
    if (!session) {
      return { success: false, error: "This link is no longer valid — it may be expired or already used." };
    }
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export interface SubmitDriverSignParams {
  token: string;
  driverName: string;
  driverIdNumber?: string;
  truckNumber?: string;
}

export type SubmitDriverSignState =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Anonymous-facing: the actual signature. Sequence mirrors
 * signManifestAction in manifestActions.ts as closely as this very
 * different trust context allows — live re-fetch of the manifest and
 * server-recomputed certification text (never trusted from the client or
 * from the token's display snapshot), and consent always recorded,
 * success or failure.
 */
export async function submitDriverSignAction(
  params: SubmitDriverSignParams
): Promise<SubmitDriverSignState> {
  if (!params.driverName.trim()) {
    return { success: false, error: "Driver name is required." };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent");

  // Claimed BEFORE the RCRAInfo call, not after — closes the double-submit
  // race a naive "check then act" sequence would leave open (see
  // claim_driver_sign_token's comment in the migration).
  const claimed = await claimDriverSignToken(supabase, params.token);
  if (!claimed) {
    return { success: false, error: "This link is no longer valid — it may be expired or already used." };
  }

  const certification = certificationTextFor("Transporter");

  const recordResult = (outcome: { signSucceeded: boolean; epaReportId?: string; epaError?: string }, siteId: string) =>
    recordDriverSignResult(supabase, {
      tokenId: claimed.tokenId,
      epaMtn: claimed.epaMtn,
      transporterOrder: claimed.transporterOrder,
      siteId,
      driverName: params.driverName.trim(),
      driverIdNumber: params.driverIdNumber?.trim() || undefined,
      truckNumber: params.truckNumber?.trim() || undefined,
      certificationHeading: certification.heading,
      certificationText: certification.paragraphs.join("\n\n"),
      certificationIsVerbatim: certification.isVerbatim,
      ipAddress,
      userAgent,
      ...outcome,
    });

  try {
    const credentials = await getTransporterCredentials(supabase, claimed.transporterId);
    if (!credentials) {
      await releaseDriverSignToken(supabase, claimed.tokenId);
      await recordResult({ signSucceeded: false, epaError: "Transporter credentials revoked." }, "");
      return { success: false, error: "This transporter's SMS signing access has been revoked." };
    }

    const client = clientFor(credentials);

    // Live re-fetch — never trust the token's snapshot for the actual
    // signature. If the manifest was amended (transporter removed or
    // reordered) since the SMS went out, fail closed rather than let
    // EPA's own order enforcement be the only backstop.
    const freshManifest = await client.getManifest(claimed.epaMtn);
    const transporter = freshManifest.transporters.find(
      (t) => (t.order ?? 0) === claimed.transporterOrder && t.epaSiteId === credentials.epaSiteId
    );
    if (!transporter) {
      await releaseDriverSignToken(supabase, claimed.tokenId);
      await recordResult(
        { signSucceeded: false, epaError: "Transporter no longer listed on this manifest." },
        credentials.epaSiteId
      );
      return { success: false, error: "This link is no longer valid for this shipment." };
    }

    const result = await client.signManifest({
      siteId: credentials.epaSiteId,
      siteType: "Transporter",
      printedSignatureName: params.driverName.trim(),
      printedSignatureDate: new Date().toISOString(),
      manifestTrackingNumbers: [claimed.epaMtn],
      transporterOrder: claimed.transporterOrder,
    });

    const report = result.manifestReports[0];
    if (report?.manifestError) {
      await releaseDriverSignToken(supabase, claimed.tokenId);
      await recordResult({ signSucceeded: false, epaError: report.manifestError.message }, credentials.epaSiteId);
      return { success: false, error: report.manifestError.message };
    }

    await recordResult({ signSucceeded: true, epaReportId: result.reportId }, credentials.epaSiteId);
    await updateManifestTransporterSignedAt(
      supabase,
      claimed.createdByUserId,
      claimed.epaMtn,
      new Date().toISOString()
    );

    // Best-effort confirmation back to the same phone the original link
    // went to — signing already succeeded regardless of whether this
    // send works, so a failure here is logged, not surfaced as an error.
    // How the driver treats this text (as a go-ahead to depart) is
    // outside ManifestMate's concern — this is a one-way notice, not a
    // request for a reply (see the earlier design note on why the SMS
    // flow is deliberately one-way throughout this feature).
    if (claimed.driverPhone) {
      const confirmationParts = [
        `ManifestMate: Manifest ${claimed.epaMtn} signed.`,
        `Driver: ${params.driverName.trim()}`,
      ];
      if (params.driverIdNumber?.trim()) confirmationParts.push(`ID: ${params.driverIdNumber.trim()}`);
      if (params.truckNumber?.trim()) confirmationParts.push(`Truck: ${params.truckNumber.trim()}`);
      confirmationParts.push(new Date().toLocaleDateString("en-US"));
      confirmationParts.push("You're cleared to go.");

      try {
        await sendSms(claimed.driverPhone, confirmationParts.join(" "));
      } catch (confirmErr) {
        console.error("Post-sign confirmation SMS failed (non-fatal):", confirmErr);
      }
    }

    return {
      success: true,
      message: report?.manifestSigned?.message ?? "Signed — thank you.",
    };
  } catch (err) {
    const errorMessage = formatRcrainfoError(err);
    await releaseDriverSignToken(supabase, claimed.tokenId);
    await recordResult({ signSucceeded: false, epaError: errorMessage }, "");
    return { success: false, error: errorMessage };
  }
}
