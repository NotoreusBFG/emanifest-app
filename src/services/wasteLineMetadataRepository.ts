import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export type WastewaterCategory = "wastewater" | "nonwastewater";

export interface WasteLineMetadata {
  wastewaterCategory: WastewaterCategory;
  /** Lets the LDR notice's "how must this waste be managed?" picker
   * default straight to letter E (lab pack) when prefilled, instead of
   * the generic letter A default. */
  isLabPack: boolean;
}

/** Persists per-line metadata captured at manifest-creation time -- see
 * the migrations' comments for why this can't live on the manifest itself
 * (RCRAInfo's schema has no such fields). Upserted rather than inserted so
 * re-saving the same manifest (e.g. a future edit flow) doesn't create
 * duplicate rows. */
export async function upsertWasteLineMetadata(
  supabase: SupabaseClient,
  userId: string,
  epaMtn: string,
  lines: { lineNumber: number; wastewaterCategory: WastewaterCategory; isLabPack: boolean }[]
): Promise<void> {
  if (lines.length === 0) return;

  const { error } = await supabase.from("manifest_waste_line_metadata").upsert(
    lines.map((l) => ({
      user_id: userId,
      epa_mtn: epaMtn,
      line_number: l.lineNumber,
      wastewater_category: l.wastewaterCategory,
      is_lab_pack: l.isLabPack,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,epa_mtn,line_number" }
  );

  if (error) {
    // Non-fatal -- same reasoning as recordManifestLocally: this is a
    // convenience prefill source for the LDR form later, not something
    // that should block a manifest save from succeeding.
    console.error("upsertWasteLineMetadata failed (non-fatal):", describePostgrestError(error));
  }
}

/** Returns a lineNumber -> metadata map for a manifest, or an empty map if
 * nothing's been captured yet (e.g. a manifest created before this existed,
 * or the metadata write silently failed) -- callers should fall back to
 * sensible defaults per line rather than treating a miss as an error. */
export async function getWasteLineMetadataForManifest(
  supabase: SupabaseClient,
  userId: string,
  epaMtn: string
): Promise<Record<number, WasteLineMetadata>> {
  const { data, error } = await supabase
    .from("manifest_waste_line_metadata")
    .select("line_number, wastewater_category, is_lab_pack")
    .eq("user_id", userId)
    .eq("epa_mtn", epaMtn);

  if (error) {
    console.error("getWasteLineMetadataForManifest failed (non-fatal):", describePostgrestError(error));
    return {};
  }

  const map: Record<number, WasteLineMetadata> = {};
  for (const row of data ?? []) {
    map[row.line_number as number] = {
      wastewaterCategory: row.wastewater_category as WastewaterCategory,
      isLabPack: !!row.is_lab_pack,
    };
  }
  return map;
}
