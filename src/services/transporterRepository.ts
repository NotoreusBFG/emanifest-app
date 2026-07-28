import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransporterOnFile {
  id: string;
  companyName: string;
}

/**
 * Looks up whether a transporter's RCRAInfo credentials are already on
 * file for the SMS-to-driver sign flow, via the get_transporter_for_generator
 * SECURITY DEFINER function (see 20260803_create_transporters.sql) — that
 * function's SQL body deliberately selects only id/company_name, so
 * credentials are never exposed to this (or any) client-facing code path.
 * Returns null if this transporter hasn't been registered yet (Phase 1:
 * an admin runs scripts/add-transporter-credentials.ts to add one) or has
 * been revoked.
 */
export async function getTransporterForGenerator(
  supabase: SupabaseClient,
  epaSiteId: string
): Promise<TransporterOnFile | null> {
  const { data, error } = await supabase.rpc("get_transporter_for_generator", {
    p_epa_site_id: epaSiteId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? { id: row.id, companyName: row.company_name } : null;
}
