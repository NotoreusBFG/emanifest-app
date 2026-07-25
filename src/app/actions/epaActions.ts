'use server'

import { upsertEpaCredentials, upsertDefaultEmergencyPhone, getDefaultEmergencyPhone } from '@/services/epaService';
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

/**
 * Independent of saveEpaSettingsAction on purpose -- see
 * upsertDefaultEmergencyPhone's comment for why this is its own
 * form/action rather than folded into the API credentials save.
 */
export async function saveDefaultEmergencyPhoneAction(prevState: any, formData: FormData) {
  const phone = formData.get('defaultEmergencyPhone') as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await upsertDefaultEmergencyPhone(supabase, user.id, phone);

  if (result.success) {
    revalidatePath('/settings');
    return { success: true, message: 'Saved!' };
  }

  return { success: false, error: result.error };
}

/**
 * Read-only -- used to pre-fill the Settings page's emergency phone field
 * and as the manifest form's default-fill source. Unlike the API
 * credentials (write-only, never redisplayed), this isn't a secret, so
 * it's fine to read back.
 */
export async function getDefaultEmergencyPhoneAction(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getDefaultEmergencyPhone(supabase, user.id);
}