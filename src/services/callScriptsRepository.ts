import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCallScript(supabase: SupabaseClient, category: string): Promise<string | null> {
  const { data, error } = await supabase.from("call_scripts").select("script").eq("category", category).maybeSingle();
  if (error || !data) return null;
  return data.script;
}

export async function listCallScripts(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("call_scripts").select("category, script");
  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.category, row.script]));
}

export async function saveCallScript(supabase: SupabaseClient, category: string, script: string): Promise<void> {
  const { error } = await supabase
    .from("call_scripts")
    .upsert({ category, script, updated_at: new Date().toISOString() }, { onConflict: "category" });
  if (error) throw new Error(`Failed to save call script for "${category}": ${error.message}`);
}
