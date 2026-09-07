"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listManagedSites,
  addManagedSite,
  removeManagedSite,
  type ManagedSite,
} from "@/services/generatorSiteRepository";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";

export async function listMyManagedSitesAction(): Promise<ManagedSite[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return listManagedSites(supabase, user.id);
}

export type AddManagedSiteState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

/** Validates the EPA ID against RCRAInfo before saving — rejects anything
 * that doesn't come back as a Generator site, same "don't trust free text"
 * reasoning as every other EPA ID field in this app. Not an authorization
 * check (EPA has no endpoint for that, see generator_managed_sites'
 * migration comment) — just confirms the ID is real and is the right kind
 * of site. */
export async function addManagedSiteAction(
  prevState: AddManagedSiteState,
  formData: FormData
): Promise<AddManagedSiteState> {
  const epaSiteId = ((formData.get("epaSiteId") as string) ?? "").trim().toUpperCase();
  if (!epaSiteId) return { success: false, error: "Enter an EPA Site ID." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  let site;
  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    site = await client.getSiteDetails(epaSiteId);
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }

  if (site.siteType !== "Generator") {
    return {
      success: false,
      error: `${epaSiteId} is registered as a ${site.siteType ?? "non-Generator"} site, not a Generator.`,
    };
  }

  const address = site.siteAddress;
  const addressLine = [address?.address1, address?.city, address?.state?.code, address?.zip]
    .filter(Boolean)
    .join(", ");

  const result = await addManagedSite(supabase, user.id, site.epaSiteId, site.name, addressLine);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/settings");
  return { success: true, message: `Added ${site.name} (${site.epaSiteId}).` };
}

export async function removeManagedSiteAction(siteId: string): Promise<AddManagedSiteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await removeManagedSite(supabase, user.id, siteId);
  if (!result.success) return { success: false, error: result.error ?? "Failed to remove." };

  revalidatePath("/settings");
  return { success: true, message: "Site removed." };
}
