import type { Dispatch, SetStateAction } from "react";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { SiteSearchField } from "../SiteSearchField";
import { fillHandlerFromSite, type HandlerFormState } from "../ManifestFieldsForm";
import { WizardModalShell } from "./WizardModalShell";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

/** Step 3 of 4 -- designated (disposal) facility. Same HandlerFormState
 * shape and fillHandlerFromSite helper as GeneratorStepModal, different
 * site search type ("Tsdf") since generator/facility sites aren't
 * interchangeable searches in this app. */
export function FacilityStepModal({
  facility,
  setFacility,
  defaultEmergencyPhone,
  onNext,
  onBack,
  onClose,
}: {
  facility: HandlerFormState;
  setFacility: Dispatch<SetStateAction<HandlerFormState>>;
  defaultEmergencyPhone: string;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const fillFromSite = (site: Parameters<typeof fillHandlerFromSite>[0]) =>
    setFacility((f) => fillHandlerFromSite(site, f, defaultEmergencyPhone));

  return (
    <WizardModalShell title="Designated facility" step={3} totalSteps={4} onClose={onClose}>
      <SiteSearchField siteType="Tsdf" placeholder="Search registered disposal facilities by name…" onSelect={fillFromSite} />
      <div style={row}>
        <div style={field}>
          <label style={label}>EPA Site ID</label>
          <input
            value={facility.epaSiteId}
            onChange={(e) => setFacility((f) => ({ ...f, epaSiteId: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>Name</label>
          <input
            value={facility.name}
            onChange={(e) => setFacility((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={row}>
        <div style={{ ...field, flex: 2 }}>
          <label style={label}>Address</label>
          <input
            value={facility.address1}
            onChange={(e) => setFacility((f) => ({ ...f, address1: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>City</label>
          <input
            value={facility.city}
            onChange={(e) => setFacility((f) => ({ ...f, city: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={{ ...field, flex: 0.5 }}>
          <label style={label}>State</label>
          <input
            value={facility.state}
            onChange={(e) => setFacility((f) => ({ ...f, state: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={{ ...field, flex: 0.7 }}>
          <label style={label}>Zip</label>
          <input
            value={facility.zip}
            onChange={(e) => setFacility((f) => ({ ...f, zip: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 16px" }}>
        Contact name/phone/email/emergency phone can still be filled in on the review screen at the end.
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
            Next: Waste lines →
          </button>
        </div>
      </div>
    </WizardModalShell>
  );
}
