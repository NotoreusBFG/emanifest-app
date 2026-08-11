"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, getRcrainfoClientForAction } from "@/services/manifestService";
import { recordManifestLocally } from "@/services/manifestRepository";
import { formatRcrainfoError } from "@/lib/rcrainfo/formatError";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Manifest, ManifestStatus } from "@/lib/rcrainfo/types";

export interface GeneratorManifestSearchFilters {
  status?: ManifestStatus;
  dateType?: "ShippedDate" | "ReceivedDate" | "CertifiedDate" | "UpdatedDate";
  /** YYYY-MM-DDThh:mm:ss.sTZD — required together with dateType/endDate for a date-range search. */
  startDate?: string;
  endDate?: string;
}

export type ResolveGeneratorManifestListState =
  | { success: true; siteName: string; epaSiteId: string; mtns: string[] }
  | { success: false; error: string };

/**
 * Resolves a generator EPA site ID to its canonical name (confirms the ID
 * is real, same pattern as getSiteDetailsAction) and pulls the full,
 * EPA-filtered list of MTNs for it via POST /emanifest/search (see
 * `client.searchManifests`, confirmed live 2026-08-11) — not just the
 * manifests this ManifestMate account has personally touched, the
 * generator's actual live EPA record. Lightweight (just strings + a name),
 * safe to hold in full in client state even for a generator with thousands
 * of manifests. Full detail (status, waste lines) is fetched separately,
 * one page at a time, by fetchManifestDetailsBatchAction below — never
 * eagerly for the whole list.
 */
export async function resolveGeneratorManifestListAction(
  epaSiteId: string,
  filters?: GeneratorManifestSearchFilters
): Promise<ResolveGeneratorManifestListState> {
  const trimmedSiteId = epaSiteId.trim();
  if (!trimmedSiteId) return { success: false, error: "Enter a generator EPA ID." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const site = await client.getSiteDetails(trimmedSiteId);
    const mtns = await client.searchManifests({
      siteId: trimmedSiteId,
      siteType: "Generator",
      ...filters,
    });
    return { success: true, siteName: site.name ?? trimmedSiteId, epaSiteId: trimmedSiteId, mtns };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export interface ManifestBatchResult {
  mtn: string;
  success: boolean;
  manifest?: Manifest;
  error?: string;
}

const BATCH_CONCURRENCY = 5;

/**
 * Fetches full manifest detail (status + waste lines) for a small batch of
 * MTNs — the caller (GeneratorManifestResults) slices the full MTN list
 * from resolveGeneratorManifestListAction into pages of ~15 and calls this
 * once per page, never the whole list at once. One bad/permission-denied
 * MTN in a batch reports its own inline error rather than failing the
 * whole batch.
 *
 * Resolves the RCRAInfo client once, outside the concurrency loop, and
 * reuses it across every MTN in the batch — getRcrainfoClientForAction
 * does its own credential lookup + token exchange per call, so resolving
 * it per-MTN inside the loop would mean up to BATCH_CONCURRENCY redundant
 * token exchanges in flight at once for no benefit (the client caches its
 * token internally after the first exchange).
 */
export async function fetchManifestDetailsBatchAction(mtns: string[]): Promise<ManifestBatchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return mtns.map((mtn) => ({ mtn, success: false, error: "Not logged in." }));
  }

  let resolved;
  try {
    resolved = await getRcrainfoClientForAction(supabase, user.id);
  } catch (err) {
    const error = formatRcrainfoError(err);
    return mtns.map((mtn) => ({ mtn, success: false, error }));
  }
  const { client, effectiveUserId } = resolved;

  return mapWithConcurrency(mtns, BATCH_CONCURRENCY, async (mtn): Promise<ManifestBatchResult> => {
    try {
      const manifest = await client.getManifest(mtn);
      await recordManifestLocally(supabase, effectiveUserId, manifest);
      return { mtn, success: true, manifest };
    } catch (err) {
      return { mtn, success: false, error: formatRcrainfoError(err) };
    }
  });
}
