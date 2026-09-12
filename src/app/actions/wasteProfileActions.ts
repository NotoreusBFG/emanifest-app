"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createWasteProfile,
  listWasteProfilesForUser,
  updateWasteProfile,
  deleteWasteProfile,
  type WasteProfile,
} from "@/services/wasteProfileRepository";
import { resolveEffectiveUserId } from "@/services/teamRepository";
import { parseWasteProfileFormData } from "@/lib/wasteProfileFormParser";

export type WasteProfileActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

export async function createWasteProfileAction(
  prevState: WasteProfileActionState,
  formData: FormData
): Promise<WasteProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const parsed = parseWasteProfileFormData(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  // Team-aware -- a team member's saved profiles belong to the owner's
  // shared workspace, not the member's own (usually credential-less)
  // account. See team_members' additive RLS policies on waste_profiles.
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await createWasteProfile(supabase, effectiveUserId, parsed);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/profiles");
  return { success: true, message: `Saved as ${result.profile.mmProfileNumber}.` };
}

export async function updateWasteProfileAction(
  prevState: WasteProfileActionState,
  formData: FormData
): Promise<WasteProfileActionState> {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "Missing profile id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const parsed = parseWasteProfileFormData(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await updateWasteProfile(supabase, effectiveUserId, id, parsed);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/profiles");
  return { success: true, message: "Profile updated." };
}

export async function deleteWasteProfileAction(id: string): Promise<WasteProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const result = await deleteWasteProfile(supabase, user.id, id);
  if (!result.success) return { success: false, error: result.error ?? "Failed to delete." };

  revalidatePath("/profiles");
  return { success: true, message: "Profile deleted." };
}

export async function listWasteProfilesForUserAction(): Promise<WasteProfile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listWasteProfilesForUser(supabase, effectiveUserId);
}
