'use server'

import { upsertEpaCredentials } from '@/services/epaService';
import { supabase } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

/**
 * This "Messenger" handles the interaction between the 
 * user's form and our database service [2].
 */
export async function saveEpaSettingsAction(prevState: any, formData: FormData) {
  const apiId = formData.get('apiId') as string;
  const apiKey = formData.get('apiKey') as string;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await upsertEpaCredentials(user.id, apiId, apiKey);
  
  if (result.success) {
    revalidatePath('/settings');
    return { success: true, message: 'Saved successfully!' };
  }
  
  return { success: false, error: result.error };
}