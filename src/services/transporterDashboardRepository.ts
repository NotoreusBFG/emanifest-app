import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptMmin } from "@/services/manifestRepository";

export interface TransporterManifestRow {
  epaMtn: string;
  epaStatus: string | null;
  generatorName: string | null;
  generatorEpaSiteId: string | null;
  designatedFacilityName: string | null;
  designatedFacilityEpaSiteId: string | null;
  generatorSignedAt: string | null;
  transporterSignedAt: string | null;
  facilitySignedAt: string | null;
  transporterEpaSiteId: string;
  transporterOrder: number;
  updatedAt: string;
  mmin: string | null;
}

/** View-only status list for a logged-in transporter company account — see list_manifests_for_transporter_owner's comment for the security-boundary reasoning. */
export async function listManifestsForTransporterOwner(supabase: SupabaseClient): Promise<TransporterManifestRow[]> {
  const { data, error } = await supabase.rpc("list_manifests_for_transporter_owner");
  if (error) {
    console.error("listManifestsForTransporterOwner failed:", error.message);
    return [];
  }
  return (data ?? []).map(
    (r: {
      epa_mtn: string;
      epa_status: string | null;
      generator_name: string | null;
      generator_epa_site_id: string | null;
      designated_facility_name: string | null;
      designated_facility_epa_site_id: string | null;
      generator_signed_at: string | null;
      transporter_signed_at: string | null;
      facility_signed_at: string | null;
      transporter_epa_site_id: string;
      transporter_order: number;
      updated_at: string;
      mmin_encrypted: string | null;
    }) => ({
      epaMtn: r.epa_mtn,
      epaStatus: r.epa_status,
      generatorName: r.generator_name,
      generatorEpaSiteId: r.generator_epa_site_id,
      designatedFacilityName: r.designated_facility_name,
      designatedFacilityEpaSiteId: r.designated_facility_epa_site_id,
      generatorSignedAt: r.generator_signed_at,
      transporterSignedAt: r.transporter_signed_at,
      facilitySignedAt: r.facility_signed_at,
      transporterEpaSiteId: r.transporter_epa_site_id,
      transporterOrder: r.transporter_order,
      updatedAt: r.updated_at,
      mmin: decryptMmin(r.mmin_encrypted),
    })
  );
}
