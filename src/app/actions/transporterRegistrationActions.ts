"use server";

import { createClient } from "@/lib/supabase/server";
import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { encrypt } from "@/lib/cryptoUtils";
import { sendSms, SmsNotConfiguredError } from "@/lib/sms/twilioClient";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import { currentOrigin } from "./driverSignActions";
import {
  createTransporterRegistrationToken,
  getTransporterRegistrationSession,
  claimTransporterRegistrationToken,
  releaseTransporterRegistrationToken,
  completeTransporterRegistration,
  hasPendingTransporterInvite,
  getTransporterManagementSession,
  revokeTransporterByManagementToken,
  unrevokeTransporterByManagementToken,
  listTransporterInvitesForOwner,
  getTransporterNotifyContact,
  cancelTransporterRegistrationInvite,
  revokeTransporterForInvitingGenerator,
  type TransporterRegistrationSession,
  type TransporterManagementSession,
  type TransporterInviteSummary,
  type TransporterNotifyContact,
} from "@/services/transporterRegistrationRepository";

function clientFor(credentials: { apiId: string; apiKey: string }) {
  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials,
  });
}

interface InviteSendResult {
  smsSent: boolean;
  emailSent: boolean;
  smsError?: string;
  emailError?: string;
}

/** Shared by both invite-creation actions (manifest-tied and standalone) — sends over whichever channels were provided, each failure independent/non-fatal since the link itself is already valid either way. */
async function sendTransporterInviteNotifications(
  message: string,
  emailSubject: string,
  recipientPhone: string | null,
  recipientEmail: string | null
): Promise<InviteSendResult> {
  const result: InviteSendResult = { smsSent: false, emailSent: false };

  if (recipientPhone) {
    try {
      await sendSms(recipientPhone, message);
      result.smsSent = true;
    } catch (err) {
      if (!(err instanceof SmsNotConfiguredError)) {
        console.error("Transporter-registration invite SMS failed (non-fatal, link still valid):", err);
      }
      result.smsError = err instanceof Error ? err.message : "Unknown SMS error.";
    }
  }

  if (recipientEmail) {
    try {
      await sendEmail(recipientEmail, emailSubject, message);
      result.emailSent = true;
    } catch (err) {
      if (!(err instanceof EmailNotConfiguredError)) {
        console.error("Transporter-registration invite email failed (non-fatal, link still valid):", err);
      }
      result.emailError = err instanceof Error ? err.message : "Unknown email error.";
    }
  }

  return result;
}

export type CreateTransporterRegistrationInviteState =
  | { success: true; link: string; smsSent: boolean; emailSent: boolean; smsError?: string; emailError?: string }
  | { success: false; error: string; alreadyPending?: boolean };

/**
 * Owner-facing: invites the transporter at `transporterOrder` on manifest
 * `mtn` — LIVE re-fetched here, same reasoning as createDriverSignLinkAction
 * — to self-register. Called precisely when getTransporterForGenerator
 * already failed to find them on file, so unlike that action this doesn't
 * re-check first; the caller (SendForSignature.tsx) already knows.
 */
export async function createTransporterRegistrationInviteAction(
  mtn: string,
  transporterOrder: number,
  recipientPhone: string | null,
  recipientEmail: string | null
): Promise<CreateTransporterRegistrationInviteState> {
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

    const transporter = manifest.transporters.find((t) => (t.order ?? 0) === transporterOrder);
    if (!transporter) return { success: false, error: "That transporter isn't on this manifest." };

    const token = await createTransporterRegistrationToken(supabase, {
      epaSiteId: transporter.epaSiteId,
      companyName: transporter.name || transporter.epaSiteId,
      manifestEpaMtn: manifest.manifestTrackingNumber,
      recipientPhone,
      recipientEmail,
      ownerNotifyEmail: user.email ?? null,
    });

    const origin = await currentOrigin();
    const link = `${origin}/register-transporter/${token}`;
    const message = `ManifestMate: ${manifest.generator.name || manifest.generator.epaSiteId} is asking ${transporter.name || transporter.epaSiteId} to register for electronic manifest signing — ${link}`;

    const sendResult = await sendTransporterInviteNotifications(
      message,
      "Register with ManifestMate for electronic manifest signing",
      recipientPhone,
      recipientEmail
    );

    return { success: true, link, ...sendResult };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

/**
 * Owner-facing: invites a transporter by EPA Site ID directly, not tied to
 * any manifest — the entry point for the standalone /transporters page.
 * Unlike createTransporterRegistrationInviteAction (which anchors from a
 * live manifest's transporter list), this anchors from a live
 * getSiteDetails() lookup — same "never free-type/never trust a
 * client-supplied company name" discipline, just a different live source.
 * Pre-checks hasPendingTransporterInvite so a generator sees an explicit
 * "already pending" choice rather than silently triggering the
 * resend-overwrite in create_transporter_registration_token (see
 * 20260815's migration comment on the cross-generator-collision fix).
 */
export async function createStandaloneTransporterInviteAction(
  epaSiteId: string,
  recipientPhone: string | null,
  recipientEmail: string | null,
  confirmResend: boolean = false
): Promise<CreateTransporterRegistrationInviteState> {
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
    const site = await client.getSiteDetails(epaSiteId);

    if (!confirmResend) {
      const pending = await hasPendingTransporterInvite(supabase, epaSiteId);
      if (pending) {
        return {
          success: false,
          error: `An invite is already pending for ${site.name || epaSiteId}.`,
          alreadyPending: true,
        };
      }
    }

    const token = await createTransporterRegistrationToken(supabase, {
      epaSiteId: site.epaSiteId,
      companyName: site.name || site.epaSiteId,
      manifestEpaMtn: null,
      recipientPhone,
      recipientEmail,
      ownerNotifyEmail: user.email ?? null,
    });

    const origin = await currentOrigin();
    const link = `${origin}/register-transporter/${token}`;
    const message = `ManifestMate: register with ManifestMate for electronic manifest signing — ${link}`;

    const sendResult = await sendTransporterInviteNotifications(
      message,
      "Register with ManifestMate for electronic manifest signing",
      recipientPhone,
      recipientEmail
    );

    return { success: true, link, ...sendResult };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type TransporterInvitesListState =
  | { success: true; invites: TransporterInviteSummary[] }
  | { success: false; error: string };

/** Generator-facing: backs the /transporters status list. */
export async function listTransporterInvitesAction(): Promise<TransporterInvitesListState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const invites = await listTransporterInvitesForOwner(supabase);
    return { success: true, invites };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

/** Generator-facing: distinguishes "never invited" from "invited, awaiting completion" for the SendForSignature.tsx CTA. */
export async function hasPendingTransporterInviteAction(epaSiteId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  try {
    return await hasPendingTransporterInvite(supabase, epaSiteId);
  } catch (err) {
    console.error("hasPendingTransporterInviteAction failed:", err);
    return false;
  }
}

export type TransporterRegistrationSessionState =
  | { success: true; session: TransporterRegistrationSession }
  | { success: false; error: string };

/** Anonymous-facing: loads the display snapshot for the public /register-transporter/[token] page. */
export async function getTransporterRegistrationSessionAction(token: string): Promise<TransporterRegistrationSessionState> {
  const supabase = await createClient();
  try {
    const session = await getTransporterRegistrationSession(supabase, token);
    if (!session) {
      return { success: false, error: "This link is no longer valid — it may be expired or already used." };
    }
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export interface CompleteTransporterRegistrationParams {
  token: string;
  companyName: string;
  apiId: string;
  apiKey: string;
}

export type CompleteTransporterRegistrationState =
  | { success: true; manageLink: string }
  | { success: false; error: string };

/**
 * Anonymous-facing: the actual registration. Credentials are verified
 * LIVE against RCRAInfo BEFORE anything is persisted — deliberately
 * stricter than saveAndValidateCredentialsAction's "save first, validate
 * second" pattern in onboardingActions.ts, since transporters is the
 * global masterlist every generator customer can immediately act on, not
 * a private per-user row. On a bad credential check, nothing is written.
 */
export async function completeTransporterRegistrationAction(
  params: CompleteTransporterRegistrationParams
): Promise<CompleteTransporterRegistrationState> {
  if (!params.companyName.trim()) return { success: false, error: "Company name is required." };
  if (!params.apiId.trim() || !params.apiKey.trim()) {
    return { success: false, error: "Enter your RCRAInfo API ID and Key." };
  }

  const supabase = await createClient();

  // Claimed BEFORE the RCRAInfo call, not after — closes the double-submit
  // race a naive "check then act" sequence would leave open.
  const claimed = await claimTransporterRegistrationToken(supabase, params.token);
  if (!claimed) {
    return { success: false, error: "This link is no longer valid — it may be expired or already used." };
  }

  try {
    const client = clientFor({ apiId: params.apiId.trim(), apiKey: params.apiKey.trim() });
    try {
      await client.verifyCredentials();
    } catch (err) {
      await releaseTransporterRegistrationToken(supabase, claimed.tokenId);
      return { success: false, error: `Couldn't verify those credentials with RCRAInfo: ${formatRcrainfoError(err)}` };
    }

    const { managementToken } = await completeTransporterRegistration(supabase, {
      tokenId: claimed.tokenId,
      companyName: params.companyName.trim(),
      encryptedApiId: encrypt(params.apiId.trim()),
      encryptedApiKey: encrypt(params.apiKey.trim()),
    });

    const origin = await currentOrigin();
    const manageLink = `${origin}/manage-transporter/${managementToken}`;
    const companyName = params.companyName.trim();

    // Best-effort confirmation back to the transporter's own contact
    // channels (whichever were actually used at invite time) — never
    // echoes the plaintext API key, only the manage link.
    const recap = `ManifestMate: ${companyName} is registered. Manage or revoke access anytime: ${manageLink}`;
    if (claimed.recipientPhone) {
      try {
        await sendSms(claimed.recipientPhone, recap);
      } catch (err) {
        console.error("Transporter registration-complete confirmation SMS failed (non-fatal):", err);
      }
    }
    if (claimed.recipientEmail) {
      try {
        await sendEmail(claimed.recipientEmail, `${companyName} is registered with ManifestMate`, recap);
      } catch (err) {
        console.error("Transporter registration-complete confirmation email failed (non-fatal):", err);
      }
    }

    // Best-effort notification to the inviting generator.
    if (claimed.ownerNotifyEmail) {
      try {
        await sendEmail(
          claimed.ownerNotifyEmail,
          `${companyName} completed ManifestMate registration`,
          `${companyName} has registered with ManifestMate. You can now text a driver from them to sign manifests.`
        );
      } catch (err) {
        console.error("Owner registration-complete notification failed (non-fatal):", err);
      }
    }

    return { success: true, manageLink };
  } catch (err) {
    await releaseTransporterRegistrationToken(supabase, claimed.tokenId);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type TransporterManagementSessionState =
  | { success: true; session: TransporterManagementSession }
  | { success: false; error: string };

/** Anonymous-facing: loads the display snapshot for the public /manage-transporter/[managementToken] page. */
export async function getTransporterManagementSessionAction(managementToken: string): Promise<TransporterManagementSessionState> {
  const supabase = await createClient();
  try {
    const session = await getTransporterManagementSession(supabase, managementToken);
    if (!session) {
      return { success: false, error: "This management link isn't valid." };
    }
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export type ManageTransporterActionState = { success: true } | { success: false; error: string };

/**
 * Best-effort notifies whoever originally registered this transporter,
 * regardless of who performs the revoke — matches this app's established
 * "no silent surprises" pattern (post-sign confirmations, registration
 * -complete notices, etc. all work this way). Never blocks/fails the
 * revoke itself; a transporter with no invite history (added via the old
 * Phase-1 admin script) simply has no one to notify. Shared by both
 * revoke paths (management-token-based and generator-initiated).
 */
async function sendRevokeNotification(contact: TransporterNotifyContact | null) {
  if (!contact) return;
  try {
    const companyName = contact.companyName ?? "Your company";
    const message = `ManifestMate: signing access for ${companyName} was just revoked. If this wasn't you, contact whoever manages your ManifestMate registration.`;
    if (contact.recipientPhone) {
      try {
        await sendSms(contact.recipientPhone, message);
      } catch (err) {
        console.error("Revoke-notification SMS failed (non-fatal):", err);
      }
    }
    if (contact.recipientEmail) {
      try {
        await sendEmail(contact.recipientEmail, `${companyName}'s ManifestMate access was revoked`, message);
      } catch (err) {
        console.error("Revoke-notification email failed (non-fatal):", err);
      }
    }
  } catch (err) {
    console.error("sendRevokeNotification failed (non-fatal, revoke already succeeded):", err);
  }
}

export async function revokeTransporterAction(managementToken: string): Promise<ManageTransporterActionState> {
  const supabase = await createClient();
  try {
    await revokeTransporterByManagementToken(supabase, managementToken);
    const contact = await getTransporterNotifyContact(supabase, managementToken).catch(() => null);
    await sendRevokeNotification(contact);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

export async function unrevokeTransporterAction(managementToken: string): Promise<ManageTransporterActionState> {
  const supabase = await createClient();
  try {
    await unrevokeTransporterByManagementToken(supabase, managementToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

/** Generator-facing: cancels a pending invite they sent, before it's completed. */
export async function cancelTransporterInviteAction(tokenId: string): Promise<ManageTransporterActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  try {
    await cancelTransporterRegistrationInvite(supabase, tokenId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

/**
 * Generator-facing: revokes an already-registered transporter's signing
 * access directly from the inviting generator's own /transporters list —
 * see revoke_transporter_for_inviting_generator's migration comment for
 * the deliberate tradeoff this represents (any generator who's invited a
 * shared transporter can now cut off its access for every other
 * generator too). Still sends the same best-effort notification to
 * whoever originally registered, regardless of who revoked it.
 */
export async function revokeTransporterAsInvitingGeneratorAction(epaSiteId: string): Promise<ManageTransporterActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  try {
    const contact = await revokeTransporterForInvitingGenerator(supabase, epaSiteId);
    await sendRevokeNotification(contact);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}

