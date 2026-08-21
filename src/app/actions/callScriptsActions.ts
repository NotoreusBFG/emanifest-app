"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { saveCallScript } from "@/services/callScriptsRepository";

export async function saveCallScriptAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const category = formData.get("category");
  const script = formData.get("script");
  if (typeof category !== "string" || !category) throw new Error("Missing category");
  if (typeof script !== "string") throw new Error("Missing script");

  await saveCallScript(supabase, category, script);
  revalidatePath("/admin/leads/call-sheet");
}
