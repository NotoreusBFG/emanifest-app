"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getMyAccountTypeAction } from "@/app/actions/accountActions";
import { LockedGeneratorSelect } from "@/components/LockedGeneratorSelect";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";

export interface SelectedLabPackGenerator {
  epaSiteId: string;
  name: string;
  address: string;
}

function fillFromSite(site: SiteSearchResultItem): SelectedLabPackGenerator {
  const addr = site.siteAddress;
  return {
    epaSiteId: site.epaSiteId,
    name: site.name,
    address: [addr?.address1, addr?.city, addr?.state?.code, addr?.zip].filter(Boolean).join(", "),
  };
}

/**
 * Hard gate on /lab-packs -- a third party's "previous work" must always be
 * scoped to one approved customer, same reasoning LockedGeneratorSelect
 * already enforces on waste profiles/BOL/LDR. Unlike SiteFilterButtons
 * elsewhere (an optional narrow-the-list control), there is no "all
 * sites"/skip option here: children only render once a generator is
 * selected.
 */
export function LabPackGeneratorGate({
  children,
}: {
  children: (generator: SelectedLabPackGenerator) => ReactNode;
}) {
  const [accountType, setAccountType] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedLabPackGenerator | null>(null);

  useEffect(() => {
    getMyAccountTypeAction().then(setAccountType);
  }, []);

  if (selected) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-sm text-gray-700">
            Generator: <strong className="text-brand-navy">{selected.name}</strong> ({selected.epaSiteId})
          </p>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline"
          >
            Change
          </button>
        </div>
        {children(selected)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-brand-navy">Select a generator to continue</p>
      <p className="mb-3 text-xs text-gray-500">
        Lab pack jobs are always scoped to one customer/site -- pick one to see or start jobs for
        them.
      </p>
      <LockedGeneratorSelect
        onSelect={(site) => setSelected(fillFromSite(site))}
        source={accountType === "third_party" ? "customers" : "managed"}
      />
    </div>
  );
}
