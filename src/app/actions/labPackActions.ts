"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createLabPack,
  updateLabPack,
  deleteLabPack,
  getLabPack,
  listLabPacksForUser,
  linkLabPackToManifestLine,
  createLabPackJob,
  listLabPackJobsForGenerator,
  listLabPackJobsForUser,
  getLabPackJob,
  deleteLabPackJob,
  listLabPacksForJob,
  duplicateLabPack,
} from "@/services/labPackRepository";
import { resolveEffectiveUserId } from "@/services/teamRepository";
import type { LabPack, LabPackInput, LabPackJob, LabPackJobInput } from "@/lib/labPack/types";

export type LabPackActionState =
  | { success: true; message: string; labPack: LabPack }
  | { success: false; error: string };

// Line-item arrays don't fit FormData's key/value shape well, so these
// actions take a plain object payload instead of FormData -- same escape
// hatch WasteProfileFormFields uses for its wizard-mode submit path
// (onWizardSubmit), just without the FormData round-trip since there's no
// file to attach here.
export async function createLabPackAction(input: LabPackInput): Promise<LabPackActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  if (input.lineItems.length === 0) {
    return { success: false, error: "Add at least one chemical to the lab pack." };
  }

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await createLabPack(supabase, effectiveUserId, input);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true, message: "Lab pack saved.", labPack: result.labPack };
}

export async function updateLabPackAction(id: string, input: LabPackInput): Promise<LabPackActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  if (input.lineItems.length === 0) {
    return { success: false, error: "Add at least one chemical to the lab pack." };
  }

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await updateLabPack(supabase, effectiveUserId, id, input);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  revalidatePath(`/lab-packs/${id}`);
  return { success: true, message: "Lab pack updated.", labPack: result.labPack };
}

export async function deleteLabPackAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await deleteLabPack(supabase, effectiveUserId, id);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true };
}

export async function listLabPacksForUserAction(): Promise<LabPack[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listLabPacksForUser(supabase, effectiveUserId);
}

export async function getLabPackAction(id: string): Promise<LabPack | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return getLabPack(supabase, effectiveUserId, id);
}

/** Called from the manifest save flow once a linked lab pack's owning
 * waste line has a real MTN/line number -- see ManifestFieldsForm.tsx's
 * "Link an existing lab pack" control and manifestActions.ts. */
export async function linkLabPackToManifestLineAction(
  labPackId: string,
  epaMtn: string,
  manifestLineNumber: number
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  await linkLabPackToManifestLine(supabase, effectiveUserId, labPackId, epaMtn, manifestLineNumber);
}

export type LabPackJobActionState =
  | { success: true; message: string; job: LabPackJob }
  | { success: false; error: string };

export async function createLabPackJobAction(input: LabPackJobInput): Promise<LabPackJobActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  if (!input.generatorEpaId) return { success: false, error: "Select a generator first." };

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await createLabPackJob(supabase, effectiveUserId, input);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true, message: "Job created.", job: result.job };
}

export async function listLabPackJobsForGeneratorAction(epaSiteId: string): Promise<LabPackJob[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listLabPackJobsForGenerator(supabase, effectiveUserId, epaSiteId);
}

export async function listLabPackJobsForUserAction(): Promise<LabPackJob[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listLabPackJobsForUser(supabase, effectiveUserId);
}

export async function getLabPackJobAction(id: string): Promise<LabPackJob | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return getLabPackJob(supabase, effectiveUserId, id);
}

export async function deleteLabPackJobAction(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await deleteLabPackJob(supabase, effectiveUserId, id);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true };
}

export async function listLabPacksForJobAction(jobId: string): Promise<LabPack[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  return listLabPacksForJob(supabase, effectiveUserId, jobId);
}

export async function duplicateLabPackAction(
  sourceLabPackId: string,
  target: { jobId: string } | { newJobName: string }
): Promise<LabPackActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };
  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const result = await duplicateLabPack(supabase, effectiveUserId, sourceLabPackId, target);
  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/lab-packs");
  return { success: true, message: "Lab pack copied.", labPack: result.labPack };
}
