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
