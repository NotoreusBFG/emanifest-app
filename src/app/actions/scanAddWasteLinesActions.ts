"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import {
  recordManifestLocally,
  getMirroredManifestForDisplay,
  type MirroredManifestForDisplay,
} from "@/services/manifestRepository";
import { upsertWasteLineMetadata } from "@/services/wasteLineMetadataRepository";
import { linkLabPackToManifestLine } from "@/services/labPackRepository";
import { buildWasteLinesFromFormData } from "@/lib/rcrainfo/buildManifestInput";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { collectManifestOperationWarnings } from "@/lib/rcrainfo/types";

export type LoadManifestForScanState =
  | { success: true; manifest: MirroredManifestForDisplay }
  | { success: false; error: string };

/**
 * Owner-only load step for the "scan drums, add waste lines" tool
 * (`/scan`) — reads the already-mirrored generator/transporter/facility
 * data (getMirroredManifestForDisplay) instead of a live RCRAInfo
 * getManifest() call, so opening/reloading this page doesn't cost an EPA
 * API call. None of those three handlers change after a manifest is
 * created, so the mirror is a safe substitute here — the actual upload
 * step (submitScanWasteLinesAction) still live-refetches right before
 * writing, since that's the one place freshness genuinely matters.
 *
 * Deliberately requires the manifest to already be in THIS owner's local
 * mirror (not a live EPA lookup by MTN alone) — same access boundary
 * getRcrainfoClientForUser would have enforced, just checked locally now.
 */
export async function loadManifestForScanAction(mtn: string): Promise<LoadManifestForScanState> {
  const trimmed = mtn.trim();
  if (!trimmed) return { success: false, error: "Enter a manifest tracking number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const manifest = await getMirroredManifestForDisplay(supabase, user.id, trimmed);
  if (!manifest) {
    return {
      success: false,
      error: "Manifest not found in your local records — look it up once on the Dashboard first, then try again here.",
    };
  }
  return { success: true, manifest };
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
