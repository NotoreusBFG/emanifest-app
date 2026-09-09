import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountType } from "@/services/profileRepository";
import { listManagedSites } from "@/services/generatorSiteRepository";
import { listApprovedCustomers } from "@/services/thirdPartyCustomerRepository";

export interface SiteFilterOption {
  epaSiteId: string;
  siteName: string;
}

/**
 * The sites/customers an account can filter its combined lists (dashboard,
 * LDR notices, waste profiles, BOL) down to -- same source
 * LockedGeneratorSelect uses to decide what a generator/third_party account
 * can create for, reused here so "what I can filter by" always matches
 * "what I can create for." Empty for any other account type (transporter,
 * disposal), which have no multi-site combined-list concept.
 */
export async function getSiteFilterOptions(
  supabase: SupabaseClient,
  userId: string
): Promise<SiteFilterOption[]> {
  const accountType = await getAccountType(supabase, userId);

  if (accountType === "generator") {
    const sites = await listManagedSites(supabase, userId);
    return sites.map((s) => ({ epaSiteId: s.epaSiteId, siteName: s.siteName || s.epaSiteId }));
  }

  if (accountType === "third_party") {
    const customers = await listApprovedCustomers(supabase, userId);
    return customers.map((c) => ({ epaSiteId: c.epaSiteId, siteName: c.siteName || c.epaSiteId }));
  }

  return [];
}
