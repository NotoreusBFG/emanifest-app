import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";
import { computeWasteCodeKey, type LdrCertification, type LdrNotice, type LdrWasteLineEntry } from "@/lib/ldr/types";

interface LdrNoticeRow {
  id: string;
  manifest_id: string | null;
  epa_mtn: string | null;
  generator_epa_site_id: string;
  receiving_facility_epa_site_id: string;
  receiving_facility_name: string;
  waste_lines: LdrWasteLineEntry[];
  waste_code_key: string;
  prepared_date: string;
  prepared_by_name: string | null;
  certifications: LdrCertification[];
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  "id, manifest_id, epa_mtn, generator_epa_site_id, receiving_facility_epa_site_id, receiving_facility_name, waste_lines, waste_code_key, prepared_date, prepared_by_name, certifications, superseded_at, created_at, updated_at";

function fromRow(row: LdrNoticeRow): LdrNotice {
  return {
    id: row.id,
    manifestId: row.manifest_id,
    epaMtn: row.epa_mtn,
    generatorEpaSiteId: row.generator_epa_site_id,
    receivingFacilityEpaSiteId: row.receiving_facility_epa_site_id,
    receivingFacilityName: row.receiving_facility_name,
    wasteLines: row.waste_lines,
    wasteCodeKey: row.waste_code_key,
    preparedDate: row.prepared_date,
    preparedByName: row.prepared_by_name ?? "",
    certifications: row.certifications ?? [],
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listLdrNoticesForUser(supabase: SupabaseClient, userId: string): Promise<LdrNotice[]> {
  const { data, error } = await supabase
    .from("ldr_notices")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(describePostgrestError(error));
  return (data as LdrNoticeRow[]).map(fromRow);
}

export async function getLdrNoticeById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<LdrNotice | null> {
  const { data, error } = await supabase
    .from("ldr_notices")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(describePostgrestError(error));
  return data ? fromRow(data as LdrNoticeRow) : null;
}

/**
 * One active (non-superseded) notice per MTN, for the dashboard's
 * "prepared LDR, ready to view/print" icon link — matched by the
 * notice's own recorded `epa_mtn` (the shipment it was originally filed
 * for), not the broader generator/facility/waste-code check used
 * elsewhere. That's the right match for "does THIS row have one," even
 * though the same notice could in principle also cover other shipments
 * under 268.7's one-time-notice model. One batched query, not one per row.
 */
export async function listActiveLdrNoticesByMtn(
  supabase: SupabaseClient,
  userId: string,
  epaMtns: string[]
): Promise<Record<string, LdrNotice>> {
  if (epaMtns.length === 0) return {};

  const { data, error } = await supabase
    .from("ldr_notices")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .in("epa_mtn", epaMtns)
    .is("superseded_at", null);

  if (error) {
    console.error("listActiveLdrNoticesByMtn failed:", describePostgrestError(error));
    return {};
  }

  const map: Record<string, LdrNotice> = {};
  for (const row of data as LdrNoticeRow[]) {
    if (row.epa_mtn) map[row.epa_mtn] = fromRow(row);
  }
  return map;
}

/**
 * The "do we already have an active notice on file" check central to
 * 268.7(a)(2)/(a)(3)'s one-time-notice model (ldr schema.md §5) — a new
 * notice is only actually required when the waste or receiving facility
 * changes, not on every manifest. Returns the active (non-superseded)
 * notice for this exact (generator, facility, waste-code-set) combination,
 * if one exists.
 */
export async function findActiveLdrNotice(
  supabase: SupabaseClient,
  userId: string,
  generatorEpaSiteId: string,
  receivingFacilityEpaSiteId: string,
  wasteCodeKey: string
): Promise<LdrNotice | null> {
  const { data, error } = await supabase
    .from("ldr_notices")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("generator_epa_site_id", generatorEpaSiteId)
    .eq("receiving_facility_epa_site_id", receivingFacilityEpaSiteId)
    .eq("waste_code_key", wasteCodeKey)
    .is("superseded_at", null)
    .maybeSingle();

  if (error) throw new Error(describePostgrestError(error));
  return data ? fromRow(data as LdrNoticeRow) : null;
}

export interface CreateLdrNoticeInput {
  manifestId: string | null;
  epaMtn: string | null;
  generatorEpaSiteId: string;
  receivingFacilityEpaSiteId: string;
  receivingFacilityName: string;
  preparedByName: string;
  /** Each waste line carries its own `howManaged` letter now (see
   * src/lib/ldr/types.ts) — there's no single notice-wide path anymore. */
  wasteLines: LdrWasteLineEntry[];
  /** One per distinct letter among wasteLines that requires certification
   * (see LDR_MANAGEMENT_OPTIONS[letter].requiresCertification) — built by
   * the action layer, which validates every such letter actually has one
   * before calling this. Empty array is valid (e.g. every line is letter
   * A — notice only). */
  certifications: LdrCertification[];
  /** When true, marks any existing active notice for this exact
   * (generator, facility, waste-code) combination as superseded before
   * inserting the new one — the explicit "waste or facility changed"
   * confirmation from the user, not something to do silently. */
  supersedePrevious: boolean;
}

export async function createLdrNotice(
  supabase: SupabaseClient,
  userId: string,
  input: CreateLdrNoticeInput
): Promise<{ success: true; notice: LdrNotice } | { success: false; error: string }> {
  const wasteCodeKey = computeWasteCodeKey(input.wasteLines);

  if (input.supersedePrevious) {
    const existing = await findActiveLdrNotice(
      supabase,
      userId,
      input.generatorEpaSiteId,
      input.receivingFacilityEpaSiteId,
      wasteCodeKey
    );
    if (existing) {
      const { error: supersedeError } = await supabase
        .from("ldr_notices")
        .update({ superseded_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (supersedeError) return { success: false, error: describePostgrestError(supersedeError) };
    }
  }

  const { data, error } = await supabase
    .from("ldr_notices")
    .insert({
      user_id: userId,
      manifest_id: input.manifestId,
      epa_mtn: input.epaMtn,
      generator_epa_site_id: input.generatorEpaSiteId,
      receiving_facility_epa_site_id: input.receivingFacilityEpaSiteId,
      receiving_facility_name: input.receivingFacilityName,
      prepared_by_name: input.preparedByName,
      waste_lines: input.wasteLines,
      waste_code_key: wasteCodeKey,
      certifications: input.certifications,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) return { success: false, error: describePostgrestError(error) };
  return { success: true, notice: fromRow(data as LdrNoticeRow) };
}
