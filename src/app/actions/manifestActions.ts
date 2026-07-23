"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError } from "@/lib/rcrainfo/types";
import type { Manifest } from "@/lib/rcrainfo/types";

export type LookupManifestState =
  | { success: true; manifest: Manifest }
  | { success: false; error: string }
  | null;

export async function lookupManifestAction(
  prevState: LookupManifestState,
  formData: FormData
): Promise<LookupManifestState> {
  const mtn = (formData.get("mtn") as string)?.trim();
  if (!mtn) return { success: false, error: "Enter a manifest tracking number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const manifest = await client.getManifest(mtn);
    return { success: true, manifest };
  } catch (err) {
    if (err instanceof NoCredentialsError) return { success: false, error: err.message };
    if (err instanceof RcrainfoApiError) {
      return {
        success: false,
        error: `RCRAInfo error (${err.status}): ${
          (err.body as { message?: string })?.message ?? err.message
        }`,
      };
    }
    return { success: false, error: err instanceof Error ? err.message : "Unknown error." };
  }
}
