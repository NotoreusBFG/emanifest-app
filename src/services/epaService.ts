import { encrypt } from '@/lib/cryptoUtils';
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