"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import { recordManifestLocally } from "@/services/manifestRepository";
import { upsertWasteLineMetadata } from "@/services/wasteLineMetadataRepository";
import { linkLabPackToManifestLine } from "@/services/labPackRepository";
import { buildWasteLinesFromFormData } from "@/lib/rcrainfo/buildManifestInput";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { collectManifestOperationWarnings } from "@/lib/rcrainfo/types";
import type { Manifest } from "@/lib/rcrainfo/types";

export type LoadManifestForScanState =
  | { success: true; manifest: Manifest }
  | { success: false; error: string };

/**
 * Owner-only load step for the "scan drums, add waste lines" tool
 * (`/scan`) — deliberately uses getRcrainfoClientForUser, NOT
 * getRcrainfoClientForAction, so a Quick-Sign delegate (lookup/sign only)
 * can't use this to rewrite waste lines. That capability already exists,
 * scoped much more narrowly, via the MMIN-gated /edit-waste-lines/[token]
 * flow (see wasteLineEditActions.ts) — this tool is for the manifest's own
 * owner, doing the scanning themselves before handing it off for review/sign.
 */
export async function loadManifestForScanAction(mtn: string): Promise<LoadManifestForScanState> {
  const trimmed = mtn.trim();
  if (!trimmed) return { success: false, error: "Enter a manifest tracking number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const manifest = await client.getManifest(trimmed);
    return { success: true, manifest };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type SubmitScanWasteLinesState =
  | { success: true; wasteLineCount: number; warnings: string[] }
  | { success: false; error: string }
  | null;

/**
 * Applies the scanned/aggregated waste lines to an already-created manifest.
 * Same pattern as submitWasteLineEditAction's EPA round trip, minus the
 * MMIN/token machinery — this is the authenticated owner acting directly on
 * their own manifest, so there's no consent gate to check beyond auth +
 * owning real RCRAInfo credentials (enforced by getRcrainfoClientForUser
 * throwing if none are on file).
 */
export async function submitScanWasteLinesAction(
  mtn: string,
  _prevState: SubmitScanWasteLinesState,
  formData: FormData
): Promise<SubmitScanWasteLinesState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const wasteResult = buildWasteLinesFromFormData(formData);
  if (wasteResult.error) {
    return { success: false, error: wasteResult.error };
  }

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);

    // Live re-fetch, same reasoning as submitWasteLineEditAction — only the
    // waste lines this tool collected are trusted from the client, every
    // other field on the manifest is whatever EPA already has on record.
    const manifest = await client.getManifest(mtn.trim());
    manifest.wastes = wasteResult.wastes;
    if (wasteResult.lineInstructionNotes.length > 0) {
      const existingInstructions = manifest.additionalInfo?.handlingInstructions ?? "";
      const combined = [existingInstructions, ...wasteResult.lineInstructionNotes].filter(Boolean).join(" | ");
      manifest.additionalInfo = { handlingInstructions: combined };
    }

    const result = await client.updateManifest(manifest);

    await recordManifestLocally(supabase, user.id, manifest);
    await upsertWasteLineMetadata(supabase, user.id, manifest.manifestTrackingNumber, wasteResult.wasteLineMetadata);
    await Promise.all(
      wasteResult.wasteLineMetadata
        .filter((l) => l.labPackId)
        .map((l) =>
          linkLabPackToManifestLine(supabase, user.id, l.labPackId!, manifest.manifestTrackingNumber, l.lineNumber)
        )
    );

    return {
      success: true,
      wasteLineCount: wasteResult.wastes.length,
      warnings: collectManifestOperationWarnings(result),
    };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}
