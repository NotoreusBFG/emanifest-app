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