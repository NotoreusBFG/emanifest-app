import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { HazmatSearchField } from "../HazmatSearchField";
import { FederalWasteCodeField } from "../FederalWasteCodeField";
import { emptyWasteLine, type WasteLineFormState } from "../ManifestFieldsForm";
import type { HazmatEntry } from "@/lib/hazmat/types";
import { WizardModalShell } from "./WizardModalShell";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

type FederalWasteCodesFn = NonNullable<ComponentProps<typeof FederalWasteCodeField>["fetchFn"]>;

/**
 * Step 4 of 4 -- one waste line at a time, per the client's own request
 * ("complete the waste section first line... when done with the first
 * line, ask to save or add another waste line"). Mirrors the same subset
 * of fields ManifestFieldsForm's own waste-line fieldset renders for a
 * single line (skips the saved-profile/lab-pack pickers -- those stay
 * review-step-only conveniences, not part of the guided walkthrough).
 *
 * Operates on wasteLines[currentIndex] only; "Save & add another" appends
 * a fresh emptyWasteLine and advances the index, "Done" hands off to the
 * review step where every line (including this one) is still fully
 * editable in the real form.
 */
export function WasteLineStepModal({
  wasteLines,
  setWasteLines,
  currentIndex,
  federalWasteCodesFn,
  onSaveAndAddAnother,
  onDone,
  onBack,
  onClose,
}: {
  wasteLines: WasteLineFormState[];
  setWasteLines: Dispatch<SetStateAction<WasteLineFormState[]>>;
  currentIndex: number;
  federalWasteCodesFn?: FederalWasteCodesFn;
  onSaveAndAddAnother: () => void;
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const line = wasteLines[currentIndex];
  const update = (patch: Partial<WasteLineFormState>) =>
    setWasteLines((lines) => lines.map((l, i) => (i === currentIndex ? { ...l, ...patch } : l)));

  const fillFromHazmat = (entry: HazmatEntry) => {
    const nameAlreadyIncludesWaste = /\bwaste\b/i.test(entry.properShippingName);
    update({
      properShippingName: entry.properShippingName,
      hazardClass: entry.hazardClass,
      packingGroup: entry.packingGroup,
      idNumberCode: entry.idNumbers,
      ...(nameAlreadyIncludesWaste ? { isRcraWaste: false } : {}),
    });
  };

  const addAnotherLine = () => {
    const nextId = wasteLines.length ? Math.max(...wasteLines.map((l) => l.id)) + 1 : 0;
    setWasteLines((lines) => [...lines, emptyWasteLine(nextId, false)]);
    onSaveAndAddAnother();
  };

  return (
    <WizardModalShell title={`Waste line ${currentIndex + 1}`} step={4} totalSteps={4} onClose={onClose}>
      <div style={row}>
        <div style={{ ...field, flex: 0.6 }}>
          <label style={label}>
            <input
              type="checkbox"
              checked={line.dotHazardous}
              onChange={(e) => update({ dotHazardous: e.target.checked })}
              style={{ marginRight: "6px" }}
            />
            HM (DOT hazardous material)
          </label>
        </div>
        <div style={{ ...field, flex: 0.6 }}>
          <label style={{ ...label, opacity: line.dotHazardous ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={line.isRcraWaste}
              disabled={!line.dotHazardous}
              onChange={(e) => update({ isRcraWaste: e.target.checked })}
              style={{ marginRight: "6px" }}
            />
            RCRA waste
          </label>
        </div>
      </div>

      {line.dotHazardous ? (
        <>
          <HazmatSearchField
            placeholder="Search DOT hazardous materials table by shipping name…"
            onSelect={fillFromHazmat}
          />
          <div style={field}>
            <label style={label}>Proper shipping name</label>
            <textarea
              rows={2}
              value={line.properShippingName}
              onChange={(e) => update({ properShippingName: e.target.value })}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>
                <input
                  type="checkbox"
                  checked={line.rqIndicator}
                  onChange={(e) => update({ rqIndicator: e.target.checked })}
                  style={{ marginRight: "6px" }}
                />
                RQ
              </label>
            </div>
            <div style={field}>
              <label style={label}>Hazard class</label>
              <input value={line.hazardClass} onChange={(e) => update({ hazardClass: e.target.value })} style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Packing group</label>
              <input value={line.packingGroup} onChange={(e) => update({ packingGroup: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>DOT ID number code (from search above)</label>
              <input
                value={line.idNumberCode}
                readOnly
                style={{ ...inputStyle, backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
              />
            </div>
            <div style={field}>
              <label style={label}>Federal waste codes (optional)</label>
              <FederalWasteCodeField
                name={`wizard_federalWasteCode_${line.id}`}
                value={line.federalWasteCode}
                onChange={(v) => update({ federalWasteCode: v })}
                fetchFn={federalWasteCodesFn}
              />
            </div>
          </div>
        </>
      ) : (
        <div style={field}>
          <label style={label}>Waste description</label>
          <input value={line.wasteDescription} onChange={(e) => update({ wasteDescription: e.target.value })} style={inputStyle} />
        </div>
      )}

      <div style={row}>
        <div style={field}>
          <label style={label}>Quantity</label>
          <input
            type="number"
            step="any"
            value={line.quantity}
            onChange={(e) => update({ quantity: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>Unit code</label>
          <input value={line.unitCode} onChange={(e) => update({ unitCode: e.target.value })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Container count</label>
          <input
            type="number"
            value={line.containerNumber}
            onChange={(e) => update({ containerNumber: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>Container type code</label>
          <input value={line.containerTypeCode} onChange={(e) => update({ containerTypeCode: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 16px" }}>
        Every field here, plus label/lab-pack linking, ERG numbers, and any additional lines, can
        still be edited on the review screen at the end.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: "8px 16px", background: "white", color: "#666", border: "1px solid #ccc", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 16px", background: "white", color: brand.blue, border: `1px solid ${brand.blue}`, borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
          >
            Exit guided setup
          </button>
          <button
            type="button"
            onClick={addAnotherLine}
            style={{ padding: "8px 16px", background: "white", color: brand.navy, border: `1px solid ${brand.navy}`, borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
          >
            Save & add another line
          </button>
          <button type="button" onClick={onDone} style={primaryButtonStyle(false)}>
            Done — review manifest →
          </button>
        </div>
      </div>
    </WizardModalShell>
  );
}
