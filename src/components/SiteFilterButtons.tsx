"use client";

import { useEffect, useState } from "react";
import { getMySiteFilterOptionsAction } from "@/app/actions/accountActions";
import type { SiteFilterOption } from "@/lib/siteFilterOptions";

/**
 * Client-side equivalent of SiteFilterLinks -- for a client-rendered
 * combined list (waste profiles, BOL) that filters an already-fetched
 * array in place rather than re-navigating. Fetches its own options (same
 * source as LockedGeneratorSelect/SiteFilterLinks) so callers don't each
 * need their own account-type branching. Renders nothing for a single-site
 * (or no-site) account.
 */
export function SiteFilterButtons({
  value,
  onChange,
}: {
  value: string;
  onChange: (epaSiteId: string) => void;
}) {
  const [sites, setSites] = useState<SiteFilterOption[]>([]);

  useEffect(() => {
    getMySiteFilterOptionsAction().then(setSites);
  }, []);

  if (sites.length <= 1) return null;

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">Site:</span>
      <button type="button" onClick={() => onChange("")} className={pillClass(!value)}>
        All sites
      </button>
      {sites.map((s) => (
        <button
          key={s.epaSiteId}
          type="button"
          onClick={() => onChange(s.epaSiteId)}
          className={pillClass(value === s.epaSiteId)}
        >
          {s.siteName} ({s.epaSiteId})
        </button>
      ))}
    </div>
  );
}
