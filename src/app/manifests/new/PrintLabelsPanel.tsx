"use client";

import { useState } from "react";
import { generateManifestLabelsAction } from "@/app/actions/labelActions";
import { brand, brandGradient } from "@/lib/brandColors";
import type { HandlerFormState, WasteLineFormState } from "./ManifestFieldsForm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LineDraft {
  copies: number;
  accumulationStartDate: string;
}

/** Shown after a manifest saves or signs successfully. Generates container
 * labels straight from the waste lines already sitting in this form's
 * state -- profiled or freeform, see labelPrintRepository's
 * createLabelPrintsForManifestLine. One label count and one accumulation
 * date per waste line (2026-09-04 decision), not per individual copy. */
export function PrintLabelsPanel({
  wasteLines,
  generator,
  facility,
  manifestTrackingNumber,
}: {
  wasteLines: WasteLineFormState[];
  generator: HandlerFormState;
  facility: HandlerFormState;
  manifestTrackingNumber: string;
}) {
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      wasteLines.map((line) => [
        line.id,
        { copies: Math.max(1, parseInt(line.containerNumber, 10) || 1), accumulationStartDate: todayIso() },
      ])
    )
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (id: number, patch: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const handleGenerate = async () => {
    setIsPending(true);
    setError(null);
    const result = await generateManifestLabelsAction({
      manifestTrackingNumber,
      generatorName: generator.name,
      generatorAddress: [generator.address1, generator.city, generator.state, generator.zip]
        .filter(Boolean)
        .join(", "),
      generatorEpaId: generator.epaSiteId,
      disposalFacilityName: facility.name,
      disposalFacilityEpaId: facility.epaSiteId,
      lines: wasteLines.map((line) => ({
        properShippingName: line.properShippingName,
        wasteDescription: line.wasteDescription,
        dotHazardous: line.dotHazardous,
        isRcraWaste: line.isRcraWaste,
        hazardClass: line.hazardClass,
        packingGroup: line.packingGroup,
        idNumberCode: line.idNumberCode,
        federalWasteCode: line.federalWasteCode,
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
        {wasteLines.map((line) => {
          const draft = drafts[line.id];
          const description = (line.dotHazardous ? line.properShippingName : line.wasteDescription) || "(no description yet)";
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
              <span style={{ flex: "1 1 220px", fontSize: "13px", color: brand.navy }}>{description}</span>
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
