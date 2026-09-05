import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export interface BillOfLadingLine {
  id: string;
  lineNumber: number;
  wasteProfileId: string | null;
  description: string;
  quantity: number;
  unitCode: string;
  containerNumber: number;
  containerTypeCode: string;
  specialInstructions: string;
}

export interface BillOfLading {
  id: string;
  bolNumber: string;
  shipDate: string;
  shipperName: string;
  shipperAddress: string;
  shipperCity: string;
  shipperState: string;
  shipperZip: string;
  shipperContactName: string;
  shipperContactPhone: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity: string;
  consigneeState: string;
  consigneeZip: string;
  consigneeContactName: string;
  consigneeContactPhone: string;
  carrierName: string;
  carrierContactName: string;
  carrierContactPhone: string;
  specialInstructions: string;
  lines: BillOfLadingLine[];
  createdAt: string;
  updatedAt: string;
}

export interface BillOfLadingLineInput {
  wasteProfileId: string | null;
  description: string;
  quantity: number;
  unitCode: string;
  containerNumber: number;
  containerTypeCode: string;
  specialInstructions: string;
}

export interface BillOfLadingInput {
  shipDate: string;
  shipperName: string;
  shipperAddress: string;
  shipperCity: string;
  shipperState: string;
  shipperZip: string;
  shipperContactName: string;
  shipperContactPhone: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity: string;
  consigneeState: string;
  consigneeZip: string;
  consigneeContactName: string;
  consigneeContactPhone: string;
  carrierName: string;
  carrierContactName: string;
  carrierContactPhone: string;
  specialInstructions: string;
  lines: BillOfLadingLineInput[];
}

function mapLine(row: Record<string, unknown>): BillOfLadingLine {
  return {
    id: row.id as string,
    lineNumber: row.line_number as number,
    wasteProfileId: (row.waste_profile_id as string) ?? null,
    description: (row.description as string) ?? "",
    quantity: Number(row.quantity) || 0,
    unitCode: (row.unit_code as string) ?? "",
    containerNumber: Number(row.container_number) || 0,
    containerTypeCode: (row.container_type_code as string) ?? "",
    specialInstructions: (row.special_instructions as string) ?? "",
  };
}

function mapBol(row: Record<string, unknown>, lines: BillOfLadingLine[]): BillOfLading {
  return {
    id: row.id as string,
    bolNumber: row.bol_number as string,
    shipDate: row.ship_date as string,
    shipperName: (row.shipper_name as string) ?? "",
    shipperAddress: (row.shipper_address as string) ?? "",
    shipperCity: (row.shipper_city as string) ?? "",
    shipperState: (row.shipper_state as string) ?? "",
    shipperZip: (row.shipper_zip as string) ?? "",
    shipperContactName: (row.shipper_contact_name as string) ?? "",
    shipperContactPhone: (row.shipper_contact_phone as string) ?? "",
    consigneeName: (row.consignee_name as string) ?? "",
    consigneeAddress: (row.consignee_address as string) ?? "",
    consigneeCity: (row.consignee_city as string) ?? "",
    consigneeState: (row.consignee_state as string) ?? "",
    consigneeZip: (row.consignee_zip as string) ?? "",
    consigneeContactName: (row.consignee_contact_name as string) ?? "",
    consigneeContactPhone: (row.consignee_contact_phone as string) ?? "",
    carrierName: (row.carrier_name as string) ?? "",
    carrierContactName: (row.carrier_contact_name as string) ?? "",
    carrierContactPhone: (row.carrier_contact_phone as string) ?? "",
    specialInstructions: (row.special_instructions as string) ?? "",
    lines,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Two separate queries rather than a PostgREST nested-embed select
 * (`.select("*, bill_of_lading_lines(*)")`) -- no other repository in
 * this codebase relies on automatic relationship embedding, and without
 * a way to live-verify it against this project's schema cache, a plain
 * second query is the safer, consistent-with-everything-else choice. */
async function fetchLines(supabase: SupabaseClient, billOfLadingId: string): Promise<BillOfLadingLine[]> {
  const { data, error } = await supabase
    .from("bill_of_lading_lines")
    .select("*")
    .eq("bill_of_lading_id", billOfLadingId)
    .order("line_number", { ascending: true });

  if (error) {
    console.error("fetchLines (bill_of_lading_lines) failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapLine);
}

/** Creates the parent row, then its lines -- two inserts (Postgrest has no
 * cross-table transaction), but the lines insert is the only thing that
 * can fail after the parent exists, and a parent with zero lines is a
 * usable (if empty) row rather than silent data loss. */
export async function createBillOfLading(
  supabase: SupabaseClient,
  userId: string,
  input: BillOfLadingInput
): Promise<{ success: true; billOfLading: BillOfLading } | { success: false; error: string }> {
  const { data: bolRow, error: bolError } = await supabase
    .from("bills_of_lading")
    .insert({
      user_id: userId,
      ship_date: input.shipDate,
      shipper_name: input.shipperName,
      shipper_address: input.shipperAddress,
      shipper_city: input.shipperCity,
      shipper_state: input.shipperState,
      shipper_zip: input.shipperZip,
      shipper_contact_name: input.shipperContactName,
      shipper_contact_phone: input.shipperContactPhone,
      consignee_name: input.consigneeName,
      consignee_address: input.consigneeAddress,
      consignee_city: input.consigneeCity,
      consignee_state: input.consigneeState,
      consignee_zip: input.consigneeZip,
      consignee_contact_name: input.consigneeContactName,
      consignee_contact_phone: input.consigneeContactPhone,
      carrier_name: input.carrierName,
      carrier_contact_name: input.carrierContactName,
      carrier_contact_phone: input.carrierContactPhone,
      special_instructions: input.specialInstructions,
    })
    .select("*")
    .single();

  if (bolError) {
    console.error("createBillOfLading failed:", describePostgrestError(bolError));
    return { success: false, error: bolError.message };
  }

  if (input.lines.length > 0) {
    const { error: linesError } = await supabase.from("bill_of_lading_lines").insert(
      input.lines.map((line, i) => ({
        bill_of_lading_id: bolRow.id,
        line_number: i + 1,
        waste_profile_id: line.wasteProfileId,
        description: line.description,
        quantity: line.quantity,
        unit_code: line.unitCode,
        container_number: line.containerNumber,
        container_type_code: line.containerTypeCode,
        special_instructions: line.specialInstructions,
      }))
    );
    if (linesError) {
      console.error("createBillOfLading (lines) failed:", describePostgrestError(linesError));
      return { success: false, error: linesError.message };
    }
  }

  return getBillOfLading(supabase, userId, bolRow.id as string);
}

export async function getBillOfLading(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ success: true; billOfLading: BillOfLading } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("bills_of_lading")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getBillOfLading failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: "Bill of lading not found." };
  const lines = await fetchLines(supabase, data.id as string);
  return { success: true, billOfLading: mapBol(data, lines) };
}

export async function getBillOfLadingByNumber(
  supabase: SupabaseClient,
  userId: string,
  bolNumber: string
): Promise<{ success: true; billOfLading: BillOfLading } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("bills_of_lading")
    .select("*")
    .eq("bol_number", bolNumber.trim().toUpperCase())
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getBillOfLadingByNumber failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  if (!data) return { success: false, error: `No bill of lading found with number "${bolNumber}".` };
  const lines = await fetchLines(supabase, data.id as string);
  return { success: true, billOfLading: mapBol(data, lines) };
}

export interface RecentBillOfLading {
  id: string;
  bolNumber: string;
  shipperName: string;
  consigneeName: string;
  createdAt: string;
}

/** Most recent bills of lading for this user -- backs a "recent" list on
 * the lookup page, same idea as listRecentManifestSearchesAction. */
export async function listRecentBillsOfLading(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<RecentBillOfLading[]> {
  const { data, error } = await supabase
    .from("bills_of_lading")
    .select("id, bol_number, shipper_name, consignee_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listRecentBillsOfLading failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    bolNumber: row.bol_number as string,
    shipperName: (row.shipper_name as string) ?? "",
    consigneeName: (row.consignee_name as string) ?? "",
    createdAt: row.created_at as string,
  }));
}
