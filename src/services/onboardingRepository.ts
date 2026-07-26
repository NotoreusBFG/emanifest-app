import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Progress through the guided EPA/RCRAInfo registration wizard
 * (docs/epa-registration-wizard-design.md). Steps 1-3 are self-attested —
 * ManifestMate has no way to verify RCRAInfo account creation, EPA ID
 * approval, or ESA completion externally. Only the credential step is
 * actually confirmed, via a real authenticated call (see
 * RcrainfoClient.verifyCredentials).
 */
export interface OnboardingProgress {
  cdxAccountDoneAt: string | null;
  epaIdRequestedAt: string | null;
  epaIdNumber: string | null;
  esaCompletedAt: string | null;
  apiKeyGeneratedAt: string | null;
  apiCredentialsEnteredAt: string | null;
  apiCredentialsValidatedAt: string | null;
}

const EMPTY_PROGRESS: OnboardingProgress = {
  cdxAccountDoneAt: null,
  epaIdRequestedAt: null,
  epaIdNumber: null,
  esaCompletedAt: null,
  apiKeyGeneratedAt: null,
  apiCredentialsEnteredAt: null,
  apiCredentialsValidatedAt: null,
};

function fromRow(row: {
  cdx_account_done_at: string | null;
  epa_id_requested_at: string | null;
  epa_id_number: string | null;
  esa_completed_at: string | null;
  api_key_generated_at: string | null;
  api_credentials_entered_at: string | null;
  api_credentials_validated_at: string | null;
}): OnboardingProgress {
  return {
    cdxAccountDoneAt: row.cdx_account_done_at,
    epaIdRequestedAt: row.epa_id_requested_at,
    epaIdNumber: row.epa_id_number,
    esaCompletedAt: row.esa_completed_at,
    apiKeyGeneratedAt: row.api_key_generated_at,
    apiCredentialsEnteredAt: row.api_credentials_entered_at,
    apiCredentialsValidatedAt: row.api_credentials_validated_at,
  };
}

/** Returns the empty/all-null progress shape for a user who's never visited
 * the wizard yet, rather than null -- every step renders as "not started". */
export async function getOnboardingProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingProgress> {
  const { data, error } = await supabase
    .from("epa_registration_progress")
    .select(
      "cdx_account_done_at, epa_id_requested_at, epa_id_number, esa_completed_at, api_key_generated_at, api_credentials_entered_at, api_credentials_validated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? fromRow(data) : EMPTY_PROGRESS;
}

async function upsertProgress(
  supabase: SupabaseClient,
  userId: string,
  patch: Record<string, string | null>
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await supabase.from("epa_registration_progress").upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export function setCdxAccountDone(supabase: SupabaseClient, userId: string, done: boolean) {
  return upsertProgress(supabase, userId, {
    cdx_account_done_at: done ? new Date().toISOString() : null,
  });
}

/** Step 2 covers both the checkbox ("I've submitted my request") and the
 * EPA ID number itself, saved together since the number is only ever known
 * once the request is in flight or approved. */
export function setEpaIdStep(
  supabase: SupabaseClient,
  userId: string,
  requested: boolean,
  epaIdNumber: string
) {
  return upsertProgress(supabase, userId, {
    epa_id_requested_at: requested ? new Date().toISOString() : null,
    epa_id_number: epaIdNumber.trim() || null,
  });
}

export function setEsaCompleted(supabase: SupabaseClient, userId: string, done: boolean) {
  return upsertProgress(supabase, userId, {
    esa_completed_at: done ? new Date().toISOString() : null,
  });
}

export function setApiKeyGenerated(supabase: SupabaseClient, userId: string, done: boolean) {
  return upsertProgress(supabase, userId, {
    api_key_generated_at: done ? new Date().toISOString() : null,
  });
}

export function markCredentialsEntered(supabase: SupabaseClient, userId: string) {
  return upsertProgress(supabase, userId, {
    api_credentials_entered_at: new Date().toISOString(),
  });
}

/** `validated: false` explicitly clears any prior success -- a credential
 * that verified before can still fail a later re-check (e.g. revoked), and
 * the wizard should reflect that rather than keep showing stale green. */
export function setCredentialsValidated(supabase: SupabaseClient, userId: string, validated: boolean) {
  return upsertProgress(supabase, userId, {
    api_credentials_validated_at: validated ? new Date().toISOString() : null,
  });
}
