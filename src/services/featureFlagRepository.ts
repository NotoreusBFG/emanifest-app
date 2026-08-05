import type { SupabaseClient } from "@supabase/supabase-js";

export type FeatureFlag = { key: string; enabled: boolean; updatedAt: string };

/**
 * Fail-closed on any missing row or query error — an unreadable flag should
 * degrade to the risky feature being OFF, not silently ON.
 */
export async function getFeatureFlag(supabase: SupabaseClient, key: string): Promise<boolean> {
  const { data, error } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  if (error || !data) return false;
  return data.enabled === true;
}

export async function listFeatureFlags(supabase: SupabaseClient): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, updated_at")
    .order("key");
  if (error || !data) return [];
  return data.map((row) => ({ key: row.key, enabled: row.enabled, updatedAt: row.updated_at }));
}

export async function setFeatureFlag(supabase: SupabaseClient, key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new Error(`Failed to update feature flag "${key}": ${error.message}`);
}
