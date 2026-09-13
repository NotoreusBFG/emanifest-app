import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export interface CustomWasteCode {
  id: string;
  chemicalName: string;
  fCodes: string[];
  uCodes: string[];
  pCodes: string[];
  dCodes: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomWasteCodeInput {
  chemicalName: string;
  fCodes: string[];
  uCodes: string[];
  pCodes: string[];
  dCodes: string[];
  notes: string;
}

const CODE_PATTERN = /^([DFKPU])(\d{3})$/;

/** Splits a free-typed "F005, U220" style string into per-letter buckets,
 * same shape UN_WASTE_CODES already uses -- so a saved custom entry can
 * be searched/merged identically to the static list. Tokens that don't
 * match a real code pattern are dropped silently (this is the user's own
 * private list, not a validated regulatory dataset). */
export function parseWasteCodesText(text: string): {
  fCodes: string[];
  uCodes: string[];
  pCodes: string[];
  dCodes: string[];
} {
  const buckets = { F: new Set<string>(), U: new Set<string>(), P: new Set<string>(), D: new Set<string>() };
  for (const token of text.split(",").map((t) => t.trim().toUpperCase())) {
    const match = token.match(CODE_PATTERN);
    if (!match) continue;
    const letter = match[1] as keyof typeof buckets;
    buckets[letter].add(token);
  }
  return {
    fCodes: Array.from(buckets.F),
    uCodes: Array.from(buckets.U),
    pCodes: Array.from(buckets.P),
    dCodes: Array.from(buckets.D),
  };
}

function mapRow(row: Record<string, unknown>): CustomWasteCode {
  return {
    id: row.id as string,
    chemicalName: (row.chemical_name as string) ?? "",
    fCodes: (row.f_codes as string[] | null) ?? [],
    uCodes: (row.u_codes as string[] | null) ?? [],
    pCodes: (row.p_codes as string[] | null) ?? [],
    dCodes: (row.d_codes as string[] | null) ?? [],
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Upserts by (user_id, lower(chemical_name)) -- saving the same chemical
 * again updates it in place rather than creating a duplicate row that
 * would show up twice in search results. */
export async function upsertCustomWasteCode(
  supabase: SupabaseClient,
  userId: string,
  input: CustomWasteCodeInput
): Promise<{ success: true; entry: CustomWasteCode } | { success: false; error: string }> {
  const { data, error } = await supabase
    .from("custom_waste_codes")
    .upsert(
      {
        user_id: userId,
        chemical_name: input.chemicalName,
        f_codes: input.fCodes,
        u_codes: input.uCodes,
        p_codes: input.pCodes,
        d_codes: input.dCodes,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chemical_name_key" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("upsertCustomWasteCode failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true, entry: mapRow(data) };
}

export async function listCustomWasteCodesForUser(supabase: SupabaseClient, userId: string): Promise<CustomWasteCode[]> {
  const { data, error } = await supabase
    .from("custom_waste_codes")
    .select("*")
    .eq("user_id", userId)
    .order("chemical_name", { ascending: true });

  if (error) {
    console.error("listCustomWasteCodesForUser failed:", describePostgrestError(error));
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function deleteCustomWasteCode(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("custom_waste_codes").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("deleteCustomWasteCode failed:", describePostgrestError(error));
    return { success: false, error: error.message };
  }
  return { success: true };
}
