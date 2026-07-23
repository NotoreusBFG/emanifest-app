'use server'

import { upsertEpaCredentials } from '@/services/epaService';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * This "Messenger" handles the interaction between the
 * user's form and our database service [2].
 */
export async function saveEpaSettingsAction(prevState: any, formData: FormData) {
  const apiId = formData.get('apiId') as string;
  const apiKey = formData.get('apiKey') as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await upsertEpaCredentials(supabase, user.id, apiId, apiKey);
  
  if (result.success) {
    revalidatePath('/settings');
    return { success: true, message: 'Saved successfully!' };
  }
  
  return { success: false, error: result.error };
}