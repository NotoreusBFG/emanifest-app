"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateLabelsForProfilesAction } from "@/app/actions/labelActions";
import { listWasteProfilesForUserAction } from "@/app/actions/wasteProfileActions";
import { getMyAccountTypeAction } from "@/app/actions/accountActions";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import { LockedGeneratorSelect } from "@/components/LockedGeneratorSelect";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import { brand, brandGradient } from "@/lib/brandColors";

interface ResolvedGenerator {
  epaSiteId: string;
  name: string;
  address: string;
}

function fillGeneratorFromSite(site: SiteSearchResultItem): ResolvedGenerator {
  const a = site.siteAddress ?? site.mailingAddress;
  return {
    epaSiteId: site.epaSiteId,
    name: site.name,
    address: [a?.address1, a?.city, a?.state?.code, a?.zip].filter(Boolean).join(", "),
  };
}

interface Draft {
  selected: boolean;
  copies: number;
  /** "" = leave blank on the label for hand-entry later. */
  accumulationStartDate: string;
}

function emptyDraft(): Draft {
  return { selected: false, copies: 1, accumulationStartDate: "" };
}

/** Accumulation-time label printing: find a generator, then batch-print
 * labels straight from all of the current account's saved waste profiles
 * -- no manifest exists yet (manifest_tracking_number always ends up
 * blank, see createLabelPrintsForProfile), so the QR code on each label
 * is meant to be scannable later to attach that specific drum to a real
 * e-manifest once one exists (not built yet -- see 2026-09-05 notes). */
export default function LabelsByGeneratorPage() {
  const [generator, setGenerator] = useState<ResolvedGenerator | null>(null);
  const [profiles, setProfiles] = useState<WasteProfile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    listWasteProfilesForUserAction().then((list) => {
      setProfiles(list);
      setDrafts(Object.fromEntries(list.map((p) => [p.id, emptyDraft()])));
    });
    getMyAccountTypeAction().then(setAccountType);
  }, []);

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const selectedCount = Object.values(drafts).filter((d) => d.selected).length;

  const handleGenerate = async () => {
    if (!generator) return;
    setIsPending(true);
    setError(null);
    const result = await generateLabelsForProfilesAction({
      generatorName: generator.name,
      generatorAddress: generator.address,
      generatorEpaId: generator.epaSiteId,
      profiles: profiles
        .filter((p) => drafts[p.id]?.selected)
        .map((p) => ({
          profileId: p.id,
          accumulationStartDate: drafts[p.id]?.accumulationStartDate || null,
          copies: drafts[p.id]?.copies ?? 1,
        })),
    });
    setIsPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    window.open(`/labels/print?ids=${result.ids.join(",")}`, "_blank");
  };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>
        <Link href="/profiles" style={{ color: brand.blue }}>← Waste profiles</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Print labels for a generator</h1>
      <p style={{ color: "#666" }}>
        Accumulation-time labeling, before any manifest exists — the manifest tracking number stays
        blank on every label. Search a generator to stamp its name/address/EPA ID onto the labels below,
        then pick which saved profiles to print.
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "12px", marginBottom: "20px" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600, color: brand.navy }}>Generator</p>
        {accountType === "generator" ? (
          <LockedGeneratorSelect onSelect={(site) => setGenerator(fillGeneratorFromSite(site))} />
        ) : (
          <SiteSearchField
            siteType="Generator"
            placeholder="Search registered generator sites by name…"
            onSelect={(site) => setGenerator(fillGeneratorFromSite(site))}
          />
        )}
        {generator && (
          <div style={{ marginTop: "8px", fontSize: "14px" }}>
            <strong>{generator.name}</strong> ({generator.epaSiteId})
            <br />
            <span style={{ color: "#666" }}>{generator.address || "No address on file"}</span>
          </div>
        )}
      </div>

      {!generator && (
        <p style={{ color: "#888", fontSize: "14px" }}>Search and select a generator above to continue.</p>
      )}

      {generator && (
        <>
          <h2 style={{ color: brand.navy, fontSize: "18px" }}>Saved waste profiles</h2>
          {profiles.length === 0 && (
            <p style={{ color: "#888" }}>
              No saved waste profiles yet. <Link href="/profiles" style={{ color: brand.blue }}>Add one →</Link>
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {profiles.map((p) => {
              const draft = drafts[p.id] ?? emptyDraft();
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    border: `1px solid ${draft.selected ? brand.blue : "#ddd"}`,
                    borderRadius: "6px",
                    padding: "10px 12px",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 220px", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(e) => updateDraft(p.id, { selected: e.target.checked })}
                    />
                    <span>
                      <strong style={{ color: brand.navy }}>{p.profileName}</strong>{" "}
                      <span style={{ color: "#888" }}>({p.mmProfileNumber})</span>
                    </span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                    Labels:
                    <input
                      type="number"
                      min={1}
                      value={draft.copies}
                      disabled={!draft.selected}
                      onChange={(e) => updateDraft(p.id, { copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      style={{ width: "56px", padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                    Accum. start (optional):
                    <input
                      type="date"
                      value={draft.accumulationStartDate}
                      disabled={!draft.selected}
                      onChange={(e) => updateDraft(p.id, { accumulationStartDate: e.target.value })}
                      style={{ padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {error && <p style={{ color: "red" }}>❌ {error}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || selectedCount === 0}
            style={{
              background: isPending || selectedCount === 0 ? "#ccc" : brandGradient,
              color: "white",
              padding: "8px 16px",
              borderRadius: "4px",
              fontWeight: 600,
              border: "none",
              cursor: isPending || selectedCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Generating…" : `Generate & print labels${selectedCount ? ` (${selectedCount})` : ""}`}
          </button>
        </>
      )}
    </div>
  );
}
