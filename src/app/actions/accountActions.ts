"use server";

import { createClient } from "@/lib/supabase/server";
import { getAccountType, type AccountType } from "@/services/profileRepository";

/** Client-callable account-type lookup — src/app/settings/page.tsx is a
 * client component with no server-side account-type check today, so
 * sections that only apply to one account type (generator sites,
 * third-party customers) need this to decide what to render. */
export async function getMyAccountTypeAction(): Promise<AccountType> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "generator";
  return getAccountType(supabase, user.id);
}

export type SetAccountTypeState = { success: true } | { success: false; error: string } | null;

/** Admin-only, self-only account_type switch — lets an admin see the app
 * as a transporter/disposal/third_party/generator account for testing
 * without a separate signup. The real authorization boundary is the
 * set_my_account_type() RPC's own is_admin_caller() check (SECURITY
 * DEFINER, since profiles has no update policy for `authenticated` --
 * see 2026090801_add_set_my_account_type_rpc.sql); a non-admin calling
 * this just gets that RPC's "not authorized" error back. */
export async function setMyAccountTypeAction(newAccountType: AccountType): Promise<SetAccountTypeState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_account_type", { new_account_type: newAccountType });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
