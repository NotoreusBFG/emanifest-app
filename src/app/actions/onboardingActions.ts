'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { upsertEpaCredentials } from '@/services/epaService';
import { getRcrainfoClientForUser } from '@/services/manifestService';
import {
  getOnboardingProgress,
  markCredentialsEntered,
  setApiKeyGenerated,
  setCdxAccountDone,
  setCredentialsValidated,
  setEpaIdStep,
  setEsaCompleted,
  type OnboardingProgress,
} from '@/services/onboardingRepository';

type ActionState = { success: boolean; error?: string; message?: string } | null;

export async function getOnboardingProgressAction(): Promise<OnboardingProgress | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getOnboardingProgress(supabase, user.id);
}

export async function toggleCdxAccountAction(prevState: ActionState, formData: FormData) {
  const done = formData.get('done') === 'true';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await setCdxAccountDone(supabase, user.id, done);
  if (!result.success) return { success: false, error: result.error };
  revalidatePath('/onboarding');
  return { success: true };
}

export async function saveEpaIdStepAction(prevState: ActionState, formData: FormData) {
  const requested = formData.get('requested') === 'true';
  const epaIdNumber = (formData.get('epaIdNumber') as string) ?? '';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await setEpaIdStep(supabase, user.id, requested, epaIdNumber);
  if (!result.success) return { success: false, error: result.error };
  revalidatePath('/onboarding');
  return { success: true };
}

export async function toggleEsaCompletedAction(prevState: ActionState, formData: FormData) {
  const done = formData.get('done') === 'true';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await setEsaCompleted(supabase, user.id, done);
  if (!result.success) return { success: false, error: result.error };
  revalidatePath('/onboarding');
  return { success: true };
}

export async function toggleApiKeyGeneratedAction(prevState: ActionState, formData: FormData) {
  const done = formData.get('done') === 'true';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const result = await setApiKeyGenerated(supabase, user.id, done);
  if (!result.success) return { success: false, error: result.error };
  revalidatePath('/onboarding');
  return { success: true };
}

/**
 * Saves the pasted API ID/Key through the same path Settings uses
 * (upsertEpaCredentials), then immediately tests them with a real
 * RCRAInfo auth call -- this is the one step the wizard actually verifies
 * rather than taking the user's word for. Saving happens even if
 * verification fails, so the user doesn't have to retype a typo'd key.
 */
export async function saveAndValidateCredentialsAction(prevState: ActionState, formData: FormData) {
  const apiId = formData.get('apiId') as string;
  const apiKey = formData.get('apiKey') as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const saveResult = await upsertEpaCredentials(supabase, user.id, apiId, apiKey);
  if (!saveResult.success) return { success: false, error: saveResult.error };
  await markCredentialsEntered(supabase, user.id);

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    await client.verifyCredentials();
    await setCredentialsValidated(supabase, user.id, true);
    revalidatePath('/onboarding');
    return { success: true, message: "Verified — you're all set!" };
  } catch (err) {
    await setCredentialsValidated(supabase, user.id, false);
    revalidatePath('/onboarding');
    const message = err instanceof Error ? err.message : 'Verification failed';
    return { success: false, error: `Saved, but verification failed: ${message}` };
  }
}
