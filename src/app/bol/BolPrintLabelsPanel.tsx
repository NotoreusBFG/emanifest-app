"use client";

import { useState } from "react";
import { generateManifestLabelsAction } from "@/app/actions/labelActions";
import { brand, brandGradient } from "@/lib/brandColors";
import type { BillOfLading } from "@/services/billOfLadingRepository";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LineDraft {
  copies: number;
  accumulationStartDate: string;
}

/** Reuses the exact same label-generation action as real manifests
 * (generateManifestLabelsAction) -- a bill of lading line is always
 * non-hazardous (dotHazardous/isRcraWaste/hazardClass/federalWasteCode
 * all false/blank), which the label already renders correctly as
 * "NON-HAZARDOUS WASTE" per the 2026-09-04 hazard-aware title change,
 * with no changes needed to the label pipeline itself. */
export function BolPrintLabelsPanel({ billOfLading }: { billOfLading: BillOfLading }) {
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() =>
    Object.fromEntries(
      billOfLading.lines.map((line) => [
        line.id,
        { copies: Math.max(1, line.containerNumber || 1), accumulationStartDate: todayIso() },
      ])
    )
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  if (billOfLading.lines.length === 0) return null;

  const handleGenerate = async () => {
    setIsPending(true);
    setError(null);
    const result = await generateManifestLabelsAction({
      manifestTrackingNumber: billOfLading.bolNumber,
      generatorName: billOfLading.shipperName,
      generatorAddress: [billOfLading.shipperAddress, billOfLading.shipperCity, billOfLading.shipperState, billOfLading.shipperZip]
        .filter(Boolean)
        .join(", "),
      generatorEpaId: billOfLading.shipperEpaId,
      disposalFacilityName: billOfLading.consigneeName,
      disposalFacilityEpaId: billOfLading.consigneeEpaId,
      lines: billOfLading.lines.map((line) => ({
        properShippingName: "",
        wasteDescription: line.description,
        dotHazardous: false,
        isRcraWaste: false,
        hazardClass: "",
        packingGroup: "",
        idNumberCode: "",
        federalWasteCode: "",
        additionalInfo: line.specialInstructions,
        accumulationStartDate: drafts[line.id]?.accumulationStartDate || todayIso(),
        copies: drafts[line.id]?.copies ?? 1,
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
    <div style={{ marginTop: "10px", padding: "12px 14px", background: brand.tint, borderRadius: "6px", fontSize: "14px" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 600, color: brand.navy }}>Print container labels</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {billOfLading.lines.map((line) => {
          const draft = drafts[line.id];
          return (
            <div
              key={line.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                background: "white",
                border: `1px solid ${brand.tint}`,
                borderRadius: "4px",
                padding: "8px 10px",
              }}
            >
              <span style={{ flex: "1 1 220px", fontSize: "13px", color: brand.navy }}>
                Line {line.lineNumber}: {line.description || "(no description)"}
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                Labels:
                <input
                  type="number"
                  min={1}
                  value={draft?.copies ?? 1}
                  onChange={(e) => updateDraft(line.id, { copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={{ width: "56px", padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                Accum. start:
                <input
                  type="date"
                  value={draft?.accumulationStartDate ?? todayIso()}
                  onChange={(e) => updateDraft(line.id, { accumulationStartDate: e.target.value })}
                  style={{ padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
              </label>
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: "red", marginTop: "8px" }}>❌ {error}</p>}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        style={{
          marginTop: "10px",
          background: brandGradient,
          color: "white",
          padding: "6px 14px",
          borderRadius: "4px",
          fontWeight: 600,
          border: "none",
          cursor: isPending ? "default" : "pointer",
          fontSize: "13px",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Generating…" : "Generate & print labels"}
      </button>
    </div>
  );
}
