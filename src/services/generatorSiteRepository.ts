import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export interface ManagedSite {
  id: string;
  epaSiteId: string;
  siteName: string;
  siteAddress: string;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): ManagedSite {
  return {
    id: row.id as string,
    epaSiteId: row.epa_site_id as string,
    siteName: (row.site_name as string) ?? "",
    siteAddress: (row.site_address as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function listManagedSites(supabase: SupabaseClient, userId: string): Promise<ManagedSite[]> {
  const { data, error } = await supabase
    .from("generator_managed_sites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listManagedSites failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function addManagedSite(
  supabase: SupabaseClient,
  userId: string,
  epaSiteId: string,
  siteName: string,
  siteAddress: string
): Promise<{ success: true; site: ManagedSite } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("generator_managed_sites")
    .insert({ user_id: userId, epa_site_id: epaSiteId, site_name: siteName, site_address: siteAddress })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You've already added this site." };
    }
    console.error("addManagedSite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, site: mapRow(data) };
}

export async function removeManagedSite(
  supabase: SupabaseClient,
  userId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("generator_managed_sites")
    .delete()
    .eq("id", siteId)
    .eq("user_id", userId);

  if (error) {
    console.error("removeManagedSite failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}
