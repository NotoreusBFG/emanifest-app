'use server'

import { createClient } from '@/lib/supabase/server';

/**
 * Per-account switch for the daily Exception Report email reminders.
 * Stored as a row in exception_report_email_optout (present = opted out);
 * the cron route skips opted-out users. RLS lets each user read, insert
 * and delete only their own row.
 */
export async function getExceptionRemindersEnabledAction(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;
  const { data } = await supabase
    .from('exception_report_email_optout')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !data;
}

export async function setExceptionRemindersEnabledAction(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not signed in.' };

  const { error } = enabled
    ? await supabase.from('exception_report_email_optout').delete().eq('user_id', user.id)
    : await supabase
        .from('exception_report_email_optout')
        .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) return { success: false, error: 'Could not save that change. Please try again.' };
  return { success: true };
}
