import type { SupabaseClient } from "@supabase/supabase-js";
import type { Manifest } from "@/lib/rcrainfo/types";

export interface LocalManifestRecord {
  id: string;
  epa_mtn: string;
  epa_status: string | null;
  generator_name: string | null;
  generator_epa_site_id: string | null;
  designated_facility_name: string | null;
  designated_facility_epa_site_id: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
}

/**
 * Upserts a local mirror row for a manifest that's already been saved to
 * EPA (see `manifests` table comment in the migration for why this isn't a
 * true pre-EPA draft store yet). Called after both `createManifestAction`
 * saves and `signManifestAction` signs, so the local record's `epa_status`
 * stays reasonably fresh without needing a separate sync job.
 *
 * Deliberately swallows errors rather than throwing — EPA already has the
 * authoritative record by the time this runs; a failed local mirror write
 * shouldn't turn a real, successful save/sign into a user-facing failure.
 * Logs to the server console so a broken mirror doesn't fail silently
 * forever, just not in the user's face.
 */
export async function recordManifestLocally(
  supabase: SupabaseClient,
  userId: string,
  manifest: Pick<Manifest, "manifestTrackingNumber" | "status" | "generator" | "designatedFacility">
): Promise<void> {
  const { error } = await supabase.from("manifests").upsert(
    {
      user_id: userId,
      epa_mtn: manifest.manifestTrackingNumber,
      epa_status: manifest.status,
      generator_name: manifest.generator?.name ?? null,
      generator_epa_site_id: manifest.generator?.epaSiteId ?? null,
      designated_facility_name: manifest.designatedFacility?.name ?? null,
      designated_facility_epa_site_id: manifest.designatedFacility?.epaSiteId ?? null,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "epa_mtn" }
  );

  if (error) {
    console.error("recordManifestLocally failed (non-fatal):", error);
  }
}

export async function listManifestsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<LocalManifestRecord[]> {
  const { data, error } = await supabase
    .from("manifests")
    .select(
      "id, epa_mtn, epa_status, generator_name, generator_epa_site_id, designated_facility_name, designated_facility_epa_site_id, created_at, updated_at, last_synced_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listManifestsForUser failed:", error);
    return [];
  }
  return data;
}
