import { encrypt, decrypt } from '@/lib/cryptoUtils';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * This "Worker" function encrypts the credentials and
 * saves them to Supabase [2].
 *
 * Takes the caller's authenticated Supabase client (from
 * `@/lib/supabase/server`) rather than importing a shared instance —
 * RLS on `user_credentials` requires the request to carry the actual
 * logged-in user's session, which only the per-request server client has.
 */
export async function upsertEpaCredentials(
  supabase: SupabaseClient,
  userId: string,
  apiId: string,
  apiKey: string
) {
  const encryptedId = encrypt(apiId);
  const encryptedKey = encrypt(apiKey);

  const { data, error } = await supabase
    .from('user_credentials')
    .upsert(
      {
        user_id: userId,
        epa_api_id: encryptedId,
        epa_api_key: encryptedKey,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

/**
 * Saved independently of API credentials (own form/action) so changing
 * your emergency phone default never requires re-entering your real API
 * key, which is write-only and never redisplayed. Supabase's upsert only
 * updates the columns present in the payload on conflict — it does not
 * touch epa_api_id/epa_api_key on an existing row — but a user setting
 * this before ever saving credentials needs a fresh INSERT to succeed too,
 * hence those columns being nullable (see migration).
 */
export async function upsertDefaultEmergencyPhone(
  supabase: SupabaseClient,
  userId: string,
  phone: string
) {
  const { error } = await supabase.from('user_credentials').upsert(
    {
      user_id: userId,
      // Empty submission clears any saved override, falling back to the
      // system default (src/lib/constants.ts) rather than leaving a
      // stale value in place.
      default_emergency_phone: phone.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Returns the user's saved default emergency phone override, or `null` if
 * they haven't set one (callers should fall back to
 * SYSTEM_DEFAULT_EMERGENCY_PHONE). Doesn't throw when the user has no
 * `user_credentials` row yet (e.g. hasn't visited Settings) -- same
 * "not set yet" semantics as `getEpaCredentials`.
 */
export async function getDefaultEmergencyPhone(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('default_emergency_phone')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.default_emergency_phone ?? null;
}

/**
 * Fetches and decrypts the calling user's stored RCRAInfo API credentials.
 * Returns `null` if the user hasn't saved credentials yet (not an error —
 * callers should treat this as "needs to visit /settings first").
 */
export async function getEpaCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<{ apiId: string; apiKey: string } | null> {
  const { data, error } = await supabase
    .from('user_credentials')
    .select('epa_api_id, epa_api_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    apiId: decrypt(data.epa_api_id),
    apiKey: decrypt(data.epa_api_key),
  };
}