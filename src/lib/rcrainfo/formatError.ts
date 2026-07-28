import { NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError } from "@/lib/rcrainfo/types";

// A handful of RCRAInfo error messages are common enough (and confusing
// enough raw) to warrant a friendlier rewrite. Anything not matched here
// falls through to the raw JSON — deliberately not guessing at a friendly
// message for shapes we haven't actually seen and confirmed live.
function friendlyRcrainfoMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("message" in body)) return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== "string") return null;

  if (message.includes("Site Services Permission")) {
    return "You don't have signing permission for this site. Check with your RCRAInfo account admin to confirm you've been granted Site Services Permission for it.";
  }

  return null;
}

/**
 * Shared between manifestActions.ts and driverSignActions.ts — pulled out
 * of manifestActions.ts (a "use server" file, whose exports must all be
 * async Server Actions) since this is a plain synchronous helper.
 */
export function formatRcrainfoError(err: unknown): string {
  if (err instanceof NoCredentialsError) return err.message;
  if (err instanceof RcrainfoApiError) {
    // Save/update validation error bodies have an inconsistent shape
    // (sometimes a flat {message,field,value}, sometimes a nested report) —
    // shown raw rather than guessing a structure that might be wrong.
    return (
      friendlyRcrainfoMessage(err.body) ?? `RCRAInfo error (${err.status}): ${JSON.stringify(err.body)}`
    );
  }
  return err instanceof Error ? err.message : "Unknown error.";
}
