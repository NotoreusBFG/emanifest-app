"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  upsertCustomWasteCode,
  listCustomWasteCodesForUser,
  deleteCustomWasteCode,
  parseWasteCodesText,
  type CustomWasteCode,
} from "@/services/customWasteCodeRepository";
import { resolveEffectiveUserId } from "@/services/teamRepository";

export type CustomWasteCodeActionState =
  | { success: true; entry: CustomWasteCode }
  | { success: false; error: string };

/** Saves (or updates, if this chemical name is already saved) one entry
 * into the caller's own private chemical library -- "build the database
 * as we go" per chemical name typed/found in the quick-add modal. Takes
 * the same free-text "F005, U220" shape the modal's waste-code field
 * already uses, parsed into per-letter buckets by parseWasteCodesText. */
export async function saveCustomWasteCodeAction(
  chemicalName: string,
  wasteCodesText: string,
  notes: string
): Promise<CustomWasteCodeActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const trimmedName = chemicalName.trim();
  if (!trimmedName) return { success: false, error: "Enter a chemical name first." };

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await upsertCustomWasteCode(supabase, effectiveUserId, {
    chemicalName: trimmedName,
    ...parseWasteCodesText(wasteCodesText),
    notes: notes.trim(),
  });
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true, entry: result.entry };
}

export async function listCustomWasteCodesAction(): Promise<CustomWasteCode[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listCustomWasteCodesForUser(supabase, effectiveUserId);
}

export async function deleteCustomWasteCodeAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await deleteCustomWasteCode(supabase, effectiveUserId, id);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true };
}
