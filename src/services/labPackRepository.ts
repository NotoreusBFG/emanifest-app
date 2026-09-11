import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";
import type {
  LabPack,
  LabPackInput,
  LabPackLineItem,
  LabPackLineItemInput,
  LabPackStatus,
  PhysicalState,
} from "@/lib/labPack/types";

function mapLineItemRow(row: Record<string, unknown>): LabPackLineItem {
  return {
    id: row.id as string,
    lineNumber: row.line_number as number,
    chemicalName: row.chemical_name as string,
    quantity: (row.quantity as number | null) ?? null,
    containerSize: (row.container_size as string) ?? "",
    physicalState: (row.physical_state as PhysicalState | null) ?? null,
    epaWasteCodes: (row.epa_waste_codes as string[] | null) ?? [],
    sourceLocation: (row.source_location as string) ?? "",
    notes: (row.notes as string) ?? "",
  };
}

function mapRow(row: Record<string, unknown>, lineItems: LabPackLineItem[]): LabPack {
  return {
    id: row.id as string,
    jobNumber: (row.job_number as string) ?? "",
    generatorEpaId: (row.generator_epa_id as string) ?? "",
    generatorName: (row.generator_name as string) ?? "",
    generatorAddress: (row.generator_address as string) ?? "",
    isNonHazardous: !!row.is_non_hazardous,
    dotShippingDescription: (row.dot_shipping_description as string) ?? "",
    dotSpecialPermitNumber: (row.dot_special_permit_number as string) ?? "",
    rqIndicator: !!row.rq_indicator,
    rqCodes: (row.rq_codes as string) ?? "",
    wasteCodes: (row.waste_codes as string[] | null) ?? [],
    totalWeight: (row.total_weight as number | null) ?? null,
    outerContainerTypeCode: (row.outer_container_type_code as string) ?? "DM",
    outerContainerSize: (row.outer_container_size as string) ?? "",
    drumNumber: (row.drum_number as number | null) ?? null,
    epaMtn: (row.epa_mtn as string | null) ?? null,
    manifestLineNumber: (row.manifest_line_number as number | null) ?? null,
    status: (row.status as LabPackStatus) ?? "draft",
    lineItems,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Union of every line item's waste codes, stored denormalized on the drum
 * row so list views and the manifest-line prefill don't need a join. */
function aggregateWasteCodes(lineItems: LabPackLineItemInput[]): string[] {
  const codes = new Set<string>();
  for (const item of lineItems) {
    for (const code of item.epaWasteCodes) {
      const trimmed = code.trim().toUpperCase();
      if (trimmed) codes.add(trimmed);
    }
  }
  return Array.from(codes);
}

function toRow(input: LabPackInput) {
  return {
    job_number: input.jobNumber,
    generator_epa_id: input.generatorEpaId,
    generator_name: input.generatorName,
    generator_address: input.generatorAddress,
    is_non_hazardous: input.isNonHazardous,
    dot_shipping_description: input.dotShippingDescription,
    dot_special_permit_number: input.dotSpecialPermitNumber,
    rq_indicator: input.rqIndicator,
    rq_codes: input.rqCodes,
    waste_codes: aggregateWasteCodes(input.lineItems),
    total_weight: input.totalWeight,
    outer_container_type_code: input.outerContainerTypeCode,
    outer_container_size: input.outerContainerSize,
    drum_number: input.drumNumber,
    status: input.status,
  };
}

function lineItemToRow(labPackId: string, item: LabPackLineItemInput) {
  return {
    lab_pack_id: labPackId,
    line_number: item.lineNumber,
    chemical_name: item.chemicalName,
    quantity: item.quantity,
    container_size: item.containerSize,
    physical_state: item.physicalState,
    epa_waste_codes: item.epaWasteCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
    source_location: item.sourceLocation,
    notes: item.notes,
  };
}

/** Replaces a lab pack's line items wholesale -- simplest correct approach
 * for a small per-drum list, same "resubmit the whole set" pattern the LDR
 * waste-lines form uses rather than diffing individual rows. */
async function replaceLineItems(
  supabase: SupabaseClient,
  labPackId: string,
  lineItems: LabPackLineItemInput[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: deleteError } = await supabase.from("lab_pack_line_items").delete().eq("lab_pack_id", labPackId);
  if (deleteError) {
    console.error("replaceLineItems delete failed:", describePostgrestError(deleteError));
    return { success: false, error: deleteError.message };
  }

  if (lineItems.length === 0) return { success: true };

  const { error: insertError } = await supabase
    .from("lab_pack_line_items")
    .insert(lineItems.map((item) => lineItemToRow(labPackId, item)));
  if (insertError) {
    console.error("replaceLineItems insert failed:", describePostgrestError(insertError));
    return { success: false, error: insertError.message };
  }
  return { success: true };
}

export async function createLabPack(
  supabase: SupabaseClient,
  userId: string,
  input: LabPackInput
): Promise<{ success: true; labPack: LabPack } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("lab_packs")
    .insert({ user_id: userId, ...toRow(input) })
    .select("*")
    .single();

  if (error) {
    console.error("createLabPack failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }

  const lineItemsResult = await replaceLineItems(supabase, data.id as string, input.lineItems);
  if (!lineItemsResult.success) return { success: false, error: lineItemsResult.error };

  const labPack = await getLabPack(supabase, userId, data.id as string);
  if (!labPack) return { success: false, error: "Lab pack saved but could not be reloaded." };
  return { success: true, labPack };
}

export async function updateLabPack(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: LabPackInput
): Promise<{ success: true; labPack: LabPack } | { success: false; error: string }> {
  const { error } = await supabase
    .from("lab_packs")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("updateLabPack failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }

  const lineItemsResult = await replaceLineItems(supabase, id, input.lineItems);
  if (!lineItemsResult.success) return { success: false, error: lineItemsResult.error };

  const labPack = await getLabPack(supabase, userId, id);
  if (!labPack) return { success: false, error: "Lab pack updated but could not be reloaded." };
  return { success: true, labPack };
}

export async function getLabPack(supabase: SupabaseClient, userId: string, id: string): Promise<LabPack | null> {
  const { data, error } = await supabase.from("lab_packs").select("*").eq("id", id).eq("user_id", userId).maybeSingle();

  if (error) {
    console.error("getLabPack failed:", describePostgrestError(error));
    return null;
  }
  if (!data) return null;

  const { data: lineItemRows, error: lineItemsError } = await supabase
    .from("lab_pack_line_items")
    .select("*")
    .eq("lab_pack_id", id)
    .order("line_number", { ascending: true });

  if (lineItemsError) {
    console.error("getLabPack line items failed:", describePostgrestError(lineItemsError));
    return mapRow(data, []);
  }

  return mapRow(data, (lineItemRows ?? []).map(mapLineItemRow));
}

/** List view only -- doesn't fetch line items (callers just need drum-level
 * summary fields for the list/card view, not the full chemical breakdown). */
export async function listLabPacksForUser(supabase: SupabaseClient, userId: string): Promise<LabPack[]> {
  const { data, error } = await supabase
    .from("lab_packs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listLabPacksForUser failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map((row) => mapRow(row, []));
}

export async function deleteLabPack(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("lab_packs").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("deleteLabPack failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Writes the manifest link back onto the lab pack once its owning waste
 * line has a real MTN/line number -- mirrors the Manifest #/Line # fields
 * on the reference vendor packing slip. Scoped by userId like every other
 * write here; silently no-ops if the pack doesn't belong to this user
 * (defensive -- callers only ever pass IDs the user just selected). */
export async function linkLabPackToManifestLine(
  supabase: SupabaseClient,
  userId: string,
  labPackId: string,
  epaMtn: string,
  manifestLineNumber: number
): Promise<void> {
  const { error } = await supabase
    .from("lab_packs")
    .update({ epa_mtn: epaMtn, manifest_line_number: manifestLineNumber, updated_at: new Date().toISOString() })
    .eq("id", labPackId)
    .eq("user_id", userId);

  if (error) {
    // Non-fatal -- same reasoning as upsertWasteLineMetadata: this is a
    // traceability convenience, not something that should block a manifest
    // save from succeeding.
    console.error("linkLabPackToManifestLine failed (non-fatal):", describePostgrestError(error));
  }
}
