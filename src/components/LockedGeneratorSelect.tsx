"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyManagedSitesAction } from "@/app/actions/generatorSiteActions";
import { getSiteDetailsAction } from "@/app/actions/manifestActions";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";

interface LockedGeneratorSelectProps {
  /** Same contract as SiteSearchField's onSelect -- a drop-in replacement
   * wherever generator selection needs to be closed instead of open EPA
   * search. Called with a full SiteDetails/SiteSearchResultItem (a live
   * getSiteDetailsAction lookup on the chosen EPA ID), never the cached
   * display-only name/address, so callers get real contact/address data
   * exactly like they would from SiteSearchField. */
  onSelect: (site: SiteSearchResultItem) => void;
}

/**
 * Restricts generator selection to the caller's own declared sites
 * (generator_managed_sites via Settings) instead of the open EPA site
 * search any account could previously use for the generator slot. Zero
 * sites -> prompts to add one in Settings. One site -> auto-selected,
 * shown read-only. Multiple -> a closed dropdown, no free text/search.
 */
export function LockedGeneratorSelect({ onSelect }: LockedGeneratorSelectProps) {
  const [sites, setSites] = useState<{ id: string; epaSiteId: string; siteName: string }[] | null>(null);
  const [selectedEpaSiteId, setSelectedEpaSiteId] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyManagedSitesAction().then(setSites);
  }, []);

  const resolveAndSelect = async (epaSiteId: string) => {
    setIsResolving(true);
    setError(null);
    const result = await getSiteDetailsAction(epaSiteId);
    setIsResolving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSelectedEpaSiteId(epaSiteId);
    onSelect(result.site);
  };

  // Auto-select the only option -- this is the common case (a single-site
  // generator) and matches the old onboarding-prefill convenience without
  // requiring a click.
  useEffect(() => {
    if (sites && sites.length === 1 && !selectedEpaSiteId) {
      resolveAndSelect(sites[0].epaSiteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time auto-select once the list resolves
  }, [sites]);

  if (sites === null) {
    return <p style={{ fontSize: "13px", color: "#888" }}>Loading your generator sites…</p>;
  }

  if (sites.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: "#a15c00" }}>
        You haven&apos;t added any generator sites yet.{" "}
        <Link href="/settings" style={{ color: brand.blue }}>
          Add one in Settings →
        </Link>
      </p>
    );
  }

  if (sites.length === 1) {
    const site = sites[0];
    return (
      <div style={{ fontSize: "14px", marginBottom: "8px" }}>
        <strong style={{ color: brand.navy }}>{site.siteName}</strong> ({site.epaSiteId})
        {isResolving && <span style={{ color: "#888" }}> — loading details…</span>}
        {error && <p style={{ color: "red", fontSize: "13px" }}>❌ {error}</p>}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "8px" }}>
      <select
        value={selectedEpaSiteId}
        onChange={(e) => e.target.value && resolveAndSelect(e.target.value)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: "4px",
          border: `1px solid ${brand.blue}`,
          background: "white",
        }}
      >
        <option value="">— Select a generator site —</option>
        {sites.map((s) => (
          <option key={s.id} value={s.epaSiteId}>
            {s.siteName} ({s.epaSiteId})
          </option>
        ))}
      </select>
      {isResolving && <p style={{ fontSize: "13px", color: "#888" }}>Loading details…</p>}
      {error && <p style={{ color: "red", fontSize: "13px" }}>❌ {error}</p>}
    </div>
  );
}
