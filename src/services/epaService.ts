import { encrypt } from '@/lib/cryptoUtils';
import { supabase } from '@/lib/supabaseClient';

/**
 * This "Worker" function encrypts the credentials and 
 * saves them to Supabase [2].
 */
export async function upsertEpaCredentials(userId: string, apiId: string, apiKey: string) {
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