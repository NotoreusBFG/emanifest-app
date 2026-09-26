import type { Dispatch, SetStateAction } from "react";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { SiteSearchField } from "../SiteSearchField";
import type { TransporterFormState } from "../ManifestFieldsForm";
import { WizardModalShell } from "./WizardModalShell";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

/**
 * Step 2 of 4 -- the first transporter only (Item 6). Adding a 2nd+
 * transporter stays a review-step action (ManifestFieldsForm's own
 * "+ Add another transporter" button) rather than a nested loop here --
 * matches this modal's "get one thing moving" scope, same reasoning
 * WasteLineStepModal uses its own loop for waste lines specifically
 * because that's the field the client's request called out by name.
 */
export function TransporterStepModal({
  transporters,
  setTransporters,
  onNext,
  onBack,
  onClose,
}: {
  transporters: TransporterFormState[];
  setTransporters: Dispatch<SetStateAction<TransporterFormState[]>>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const first = transporters[0];
  const update = (patch: Partial<TransporterFormState>) =>
    setTransporters((list) => list.map((t, i) => (i === 0 ? { ...t, ...patch } : t)));

  return (
    <WizardModalShell title="Transporter" step={2} totalSteps={4} onClose={onClose}>
      <SiteSearchField
        siteType="Transporter"
        placeholder="Search registered transporters by name…"
        onSelect={(site) => update({ epaSiteId: site.epaSiteId, name: site.name })}
      />
      <div style={row}>
        <div style={field}>
          <label style={label}>EPA Site ID</label>
          <input value={first.epaSiteId} onChange={(e) => update({ epaSiteId: e.target.value })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Name</label>
          <input value={first.name} onChange={(e) => update({ name: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 16px" }}>
        Need more than one transporter? Add the rest on the review screen at the end.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: "8px 16px", background: "white", color: "#666", border: "1px solid #ccc", borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 16px", background: "white", color: brand.blue, border: `1px solid ${brand.blue}`, borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
          >
            Exit guided setup
          </button>
          <button type="button" onClick={onNext} style={primaryButtonStyle(false)}>
            Next: Designated facility →
          </button>
        </div>
      </div>
    </WizardModalShell>
  );
}
