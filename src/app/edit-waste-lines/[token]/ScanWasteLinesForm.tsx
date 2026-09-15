"use client";

import { useActionState, useCallback, useState } from "react";
import { submitWasteLineEditAction, type SubmitWasteLineEditState } from "@/app/actions/wasteLineEditActions";
import type { WasteLineEditSession } from "@/services/wasteLineEditRepository";
import { emptyWasteLine, type WasteLineFormState } from "@/app/manifests/new/ManifestFieldsForm";
import { useQrLabelScanner, type LabelPrint } from "@/lib/useQrLabelScanner";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { brand } from "@/lib/brandColors";

// A scanned label never carries a real quantity (a drum's weight isn't on
// the printed label) or a container type -- these are the same fallback
// defaults emptyWasteLine's own "prefill" branch uses, left as hidden
// fields here since this page has no field for them. Total weight is the
// ONE thing the scanner has to type in per item, since it's the one value
// EPA's schema requires that scanning genuinely can't supply.
const DEFAULT_UNIT_CODE = "P"; // Pounds
const DEFAULT_CONTAINER_TYPE_CODE = "DM"; // Metal drum

function newScannedLine(id: number, label: LabelPrint, groupKey: string): WasteLineFormState {
  return {
    ...emptyWasteLine(id, false),
    dotHazardous: label.dotHazardous,
    isRcraWaste: label.isRcraWaste,
    properShippingName: label.properShippingName,
    hazardClass: label.hazardClass,
    packingGroup: label.packingGroup,
    idNumberCode: label.idNumberCode,
    federalWasteCode: label.federalWasteCode,
    wasteDescription: label.wasteDescription,
    containerNumber: "1",
    unitCode: DEFAULT_UNIT_CODE,
    containerTypeCode: DEFAULT_CONTAINER_TYPE_CODE,
    scanGroupKey: groupKey,
  };
}

/**
 * Compact, mobile-first counterpart to EditWasteLinesForm.tsx — same
 * underlying token/MMIN/submit machinery, but for a "Text to scan" invite
 * (session.via === "scan"): a header, the manifest's facility, a scan
 * button, the list of what's been scanned so far, an MMIN field, and one
 * Confirm & upload button. No profile/lab-pack pickers, no manual DOT
 * fields — matches the look of /sign/[token]'s DriverSignForm rather than
 * the full desktop create-manifest form.
 */
export function ScanWasteLinesForm({ token, session }: { token: string; session: WasteLineEditSession }) {
  const [lines, setLines] = useState<WasteLineFormState[]>([]);
  const [mmin, setMmin] = useState("");

  const onLabelResolved = useCallback((label: LabelPrint) => {
    const groupKey = label.wasteProfileId ?? label.id;
    setLines((current) => {
      const existing = current.find((l) => l.scanGroupKey === groupKey);
      if (existing) {
        const count = (parseInt(existing.containerNumber, 10) || 1) + 1;
        return current.map((l) => (l.id === existing.id ? { ...l, containerNumber: String(count) } : l));
      }
      const nextId = current.length ? Math.max(...current.map((l) => l.id)) + 1 : 0;
      return [...current, newScannedLine(nextId, label, groupKey)];
    });
  }, []);

  const { scanning, scanError, scanLoading, videoRef, canvasRef, startScan, stopScan } = useQrLabelScanner(
    session.designatedFacilityEpaSiteId ?? "",
    onLabelResolved
  );

  const setQuantity = (id: number, quantity: string) => {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, quantity } : l)));
  };
  const removeLine = (id: number) => {
    setLines((current) => current.filter((l) => l.id !== id));
  };

  const boundAction = useCallback(
    (prevState: SubmitWasteLineEditState, formData: FormData) => submitWasteLineEditAction(token, prevState, formData),
    [token]
  );
  const [state, formAction, isPending] = useActionState<SubmitWasteLineEditState, FormData>(boundAction, null);

  const readyToConfirm = lines.length > 0 && lines.every((l) => l.quantity.trim() !== "") && mmin.trim().length === 4;

  if (state?.success) {
    return (
      <p style={{ color: "green", fontSize: "15px" }}>
        ✅ Uploaded — {state.wasteLineCount} waste line(s) added to manifest {session.epaMtn}.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "14px", color: "#333" }}>
        <strong>{session.generatorName ?? "The generator"}</strong> is shipping manifest{" "}
        <strong>{session.epaMtn}</strong> to <strong>{session.designatedFacilityName ?? "the designated facility"}</strong>.
      </p>

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          border: `1px dashed ${brand.blue}`,
          borderRadius: "6px",
        }}
      >
        {!scanning ? (
          <button
            type="button"
            onClick={startScan}
            disabled={scanLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: "white",
              color: brand.blue,
              border: `1px solid ${brand.blue}`,
              borderRadius: "4px",
              fontWeight: 600,
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            {scanLoading ? "Looking up label…" : "📷 Scan a drum's QR code"}
          </button>
        ) : (
          <div>
            <video ref={videoRef} muted playsInline style={{ width: "100%", borderRadius: "6px" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <button
              type="button"
              onClick={stopScan}
              style={{
                marginTop: "8px",
                width: "100%",
                padding: "10px 16px",
                backgroundColor: "white",
                color: "#c00",
                border: "1px solid #c00",
                borderRadius: "4px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {scanError && <p style={{ color: "#c00", fontSize: "13px", margin: "8px 0 0" }}>{scanError}</p>}
      </div>

      {lines.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
            Scanned so far
          </label>
          {lines.map((line) => (
            <div
              key={line.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "8px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>
                  {line.wasteDescription || line.properShippingName}
                </div>
                <div style={{ fontSize: "12px", color: "#888" }}>{line.containerNumber} container(s)</div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => setQuantity(line.id, e.target.value)}
                placeholder="Total lbs"
                style={{ ...inputStyle, width: "90px" }}
              />
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                aria-label="Remove"
                style={{ background: "none", border: "none", color: "#c00", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form id="scan-waste-lines-form" action={formAction} style={{ marginTop: "16px" }}>
        <input type="hidden" name="wasteLineIds" value={lines.map((l) => l.id).join(",")} />
        {lines.map((line) => (
          <span key={line.id}>
            <input type="hidden" name={`dotHazardous_${line.id}`} value="on" />
            <input type="hidden" name={`properShippingName_${line.id}`} value={line.properShippingName} />
            <input type="hidden" name={`wasteDescription_${line.id}`} value={line.wasteDescription} />
            <input type="hidden" name={`quantity_${line.id}`} value={line.quantity} />
            <input type="hidden" name={`unitCode_${line.id}`} value={line.unitCode} />
            <input type="hidden" name={`containerNumber_${line.id}`} value={line.containerNumber} />
            <input type="hidden" name={`containerTypeCode_${line.id}`} value={line.containerTypeCode} />
            <input type="hidden" name={`federalWasteCode_${line.id}`} value={line.federalWasteCode} />
            <input type="hidden" name={`wastewaterCategory_${line.id}`} value={line.wastewaterCategory} />
            <input type="hidden" name={`idNumberCode_${line.id}`} value={line.idNumberCode} />
            <input type="hidden" name={`hazardClass_${line.id}`} value={line.hazardClass} />
            <input type="hidden" name={`packingGroup_${line.id}`} value={line.packingGroup} />
            {line.isRcraWaste && <input type="hidden" name={`isRcraWaste_${line.id}`} value="on" />}
            {line.rqIndicator && <input type="hidden" name={`rqIndicator_${line.id}`} value="on" />}
          </span>
        ))}

        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          4-digit signing code (required)
        </label>
        <input
          name="mmin"
          value={mmin}
          onChange={(e) => setMmin(e.target.value)}
          inputMode="numeric"
          maxLength={4}
          style={inputStyle}
        />
        <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0" }}>
          Ask whoever sent you this link for this manifest&apos;s 4-digit signing code (MMIN).
        </p>

        <button
          type="submit"
          disabled={!readyToConfirm || isPending}
          style={{ ...primaryButtonStyle(!readyToConfirm || isPending), marginTop: "16px", width: "100%" }}
        >
          {isPending ? "Uploading…" : "Confirm & upload"}
        </button>

        {state && !state.success && <p style={{ color: "red", marginTop: "10px" }}>❌ {state.error}</p>}
      </form>
    </div>
  );
}
