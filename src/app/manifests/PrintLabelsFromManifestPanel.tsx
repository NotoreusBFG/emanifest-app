"use client";

import { useState } from "react";
import { generateManifestLabelsAction } from "@/app/actions/labelActions";
import { brand, brandGradient } from "@/lib/brandColors";
import type { Handler, Manifest, WasteLine } from "@/lib/rcrainfo/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function handlerAddress(handler: Handler): string {
  const a = handler.siteAddress ?? handler.mailingAddress;
  if (!a) return "";
  return [a.address1, a.city, a.state?.code, a.zip].filter(Boolean).join(", ");
}

/** Best available line-1 description for a line already saved to RCRAInfo.
 * Unlike the creation form, a fetched line only ever has ONE description
 * string -- for a hazardous line RCRAInfo keeps just the combined
 * `printedDotInformation` (the separate proper shipping name/hazard
 * class/packing group aren't returned after save, only baked into that
 * string), for a non-hazardous line it's `wasteDescription`. */
function lineDescription(line: WasteLine): string {
  return (line.dotHazardous ? line.dotInformation?.printedDotInformation : line.wasteDescription) || "(no description)";
}

interface LineDraft {
  copies: number;
  accumulationStartDate: string;
}

/** Reprint entry point for an already-saved manifest, from the lookup page
 * -- unlike PrintLabelsPanel (creation flow, form state already in memory),
 * this works off the live RCRAInfo record fetched by lookupManifestAction/
 * refetchManifestAction, so it's usable days or weeks after the manifest
 * was first saved. */
export function PrintLabelsFromManifestPanel({ manifest }: { manifest: Manifest }) {
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      manifest.wastes.map((line) => [
        line.lineNumber,
        { copies: Math.max(1, line.quantity.containerNumber || 1), accumulationStartDate: todayIso() },
      ])
    )
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (lineNumber: number, patch: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [lineNumber]: { ...d[lineNumber], ...patch } }));

  if (manifest.wastes.length === 0) return null;

  const handleGenerate = async () => {
    setIsPending(true);
    setError(null);
    const result = await generateManifestLabelsAction({
      manifestTrackingNumber: manifest.manifestTrackingNumber,
      generatorName: manifest.generator.name,
      generatorAddress: handlerAddress(manifest.generator),
      generatorEpaId: manifest.generator.epaSiteId,
      disposalFacilityName: manifest.designatedFacility.name,
      disposalFacilityEpaId: manifest.designatedFacility.epaSiteId,
      lines: manifest.wastes.map((line) => ({
        // properShippingName/hazardClass/packingGroup left blank on
        // purpose -- see lineDescription's comment, that detail isn't
        // recoverable separately once a line is saved.
        properShippingName: "",
        wasteDescription: lineDescription(line),
        dotHazardous: line.dotHazardous,
        isRcraWaste: line.dotHazardous,
        hazardClass: "",
        packingGroup: "",
        idNumberCode: line.dotInformation?.idNumber?.code ?? "",
        federalWasteCode: (line.hazardousWaste?.federalWasteCodes ?? []).map((c) => c.code).join(", "),
        accumulationStartDate: drafts[line.lineNumber]?.accumulationStartDate || todayIso(),
        copies: drafts[line.lineNumber]?.copies ?? 1,
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
    <div style={{ margin: "16px 0", padding: "12px 14px", background: brand.tint, borderRadius: "6px", fontSize: "14px" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 600, color: brand.navy }}>Print container labels</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {manifest.wastes.map((line) => {
          const draft = drafts[line.lineNumber];
          return (
            <div
              key={line.lineNumber}
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
                Line {line.lineNumber}: {lineDescription(line)}
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                Labels:
                <input
                  type="number"
                  min={1}
                  value={draft?.copies ?? 1}
                  onChange={(e) =>
                    updateDraft(line.lineNumber, { copies: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  style={{ width: "56px", padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                Accum. start:
                <input
                  type="date"
                  value={draft?.accumulationStartDate ?? todayIso()}
                  onChange={(e) => updateDraft(line.lineNumber, { accumulationStartDate: e.target.value })}
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
