import type { Dispatch, SetStateAction } from "react";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { SiteSearchField } from "../SiteSearchField";
import { LockedGeneratorSelect } from "@/components/LockedGeneratorSelect";
import { fillHandlerFromSite, type HandlerFormState } from "../ManifestFieldsForm";
import { WizardModalShell } from "./WizardModalShell";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

/**
 * Step 1 of 4 -- same generator fields/search ManifestFieldsForm's
 * generator fieldset renders, populated through the SAME setGenerator
 * setter the real form uses (mirrors ImportManifestData's handleImport
 * pattern, not a parallel state shape). The review step's real
 * ManifestFieldsForm still shows every field here, editable, so this
 * modal doesn't need to be exhaustive -- just enough to get someone
 * moving without staring at the full long form first.
 */
export function GeneratorStepModal({
  generator,
  setGenerator,
  defaultEmergencyPhone,
  generatorSelectSource,
  onNext,
  onClose,
}: {
  generator: HandlerFormState;
  setGenerator: Dispatch<SetStateAction<HandlerFormState>>;
  defaultEmergencyPhone: string;
  generatorSelectSource?: "managed" | "customers";
  onNext: () => void;
  onClose: () => void;
}) {
  const fillFromSite = (site: Parameters<typeof fillHandlerFromSite>[0]) =>
    setGenerator((g) => fillHandlerFromSite(site, g, defaultEmergencyPhone));

  return (
    <WizardModalShell title="Generator" step={1} totalSteps={4} onClose={onClose}>
      {generatorSelectSource ? (
        <LockedGeneratorSelect onSelect={fillFromSite} source={generatorSelectSource} />
      ) : (
        <SiteSearchField siteType="Generator" placeholder="Search registered generators by name…" onSelect={fillFromSite} />
      )}
      <div style={row}>
        <div style={field}>
          <label style={label}>EPA Site ID</label>
          <input
            value={generator.epaSiteId}
            onChange={(e) => setGenerator((g) => ({ ...g, epaSiteId: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>Name</label>
          <input
            value={generator.name}
            onChange={(e) => setGenerator((g) => ({ ...g, name: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={row}>
        <div style={field}>
          <label style={label}>Contact first name</label>
          <input
            value={generator.firstName}
            onChange={(e) => setGenerator((g) => ({ ...g, firstName: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>Contact last name</label>
          <input
            value={generator.lastName}
            onChange={(e) => setGenerator((g) => ({ ...g, lastName: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={row}>
        <div style={{ ...field, flex: 2 }}>
          <label style={label}>Address</label>
          <input
            value={generator.address1}
            onChange={(e) => setGenerator((g) => ({ ...g, address1: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={field}>
          <label style={label}>City</label>
          <input
            value={generator.city}
            onChange={(e) => setGenerator((g) => ({ ...g, city: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={{ ...field, flex: 0.5 }}>
          <label style={label}>State</label>
          <input
            value={generator.state}
            onChange={(e) => setGenerator((g) => ({ ...g, state: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={{ ...field, flex: 0.7 }}>
          <label style={label}>Zip</label>
          <input
            value={generator.zip}
            onChange={(e) => setGenerator((g) => ({ ...g, zip: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 16px" }}>
        Phone/email/emergency phone and any other detail can still be filled in on the review screen at the end.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: "8px 16px", background: "white", color: brand.blue, border: `1px solid ${brand.blue}`, borderRadius: "4px", fontWeight: 600, cursor: "pointer" }}
        >
          Exit guided setup
        </button>
        <button type="button" onClick={onNext} style={primaryButtonStyle(false)}>
          Next: Transporter →
        </button>
      </div>
    </WizardModalShell>
  );
}
