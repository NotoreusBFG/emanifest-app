import { RcrainfoClient } from "@/lib/rcrainfo/client";
import { getEpaCredentials } from "@/services/epaService";
import type { SupabaseClient } from "@supabase/supabase-js";

export class NoCredentialsError extends Error {
  constructor() {
    super("No RCRAInfo API credentials saved yet — visit Settings first.");
    this.name = "NoCredentialsError";
  }
}

/** Builds an RcrainfoClient using the logged-in user's own stored credentials. */
export async function getRcrainfoClientForUser(supabase: SupabaseClient, userId: string) {
  const credentials = await getEpaCredentials(supabase, userId);
  if (!credentials) throw new NoCredentialsError();

  return new RcrainfoClient({
    environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
    credentials: { apiId: credentials.apiId, apiKey: credentials.apiKey },
  });
}
