"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createManifestAction, type CreateManifestState } from "@/app/actions/manifestActions";

const inputStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  boxSizing: "border-box" as const,
};

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

const DEFAULT_WASTE = {
  printedDotInformation: "RQ, Waste flammable liquids, n.o.s. (contains xylene), 3, UN1993, PG II",
  idNumberCode: "UN1993",
  federalWasteCode: "D001",
  quantity: "1",
  unitCode: "P",
  containerNumber: "1",
  containerTypeCode: "DM",
};

export default function NewManifestPage() {
  const [state, formAction, isPending] = useActionState<CreateManifestState, FormData>(
    createManifestAction,
    null
  );
  const [wasteIds, setWasteIds] = useState<number[]>([0]);

  const addWasteLine = () => {
    setWasteIds((ids) => [...ids, Math.max(...ids) + 1]);
  };

  const removeWasteLine = (id: number) => {
    setWasteIds((ids) => (ids.length > 1 ? ids.filter((i) => i !== id) : ids));
  };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>
        <Link href="/manifests" style={{ color: "#0070f3" }}>← Look up a manifest</Link>
      </p>
      <h1>Create a new manifest</h1>
      <p style={{ color: "#666" }}>
        Preprod sandbox only. Fields are pre-filled with known-good EPA test sites — edit as
        needed. Add as many waste lines as you need — RCRAInfo automatically splits them across
        the main form (4 lines) and continuation sheets (7 more per sheet); no page-numbering to
        manage here.
      </p>

      {state && !state.success && <p style={{ color: "red" }}>❌ {state.error}</p>}
      {state && state.success && (
        <p style={{ color: "green" }}>
          ✅ Saved as <strong>{state.manifestTrackingNumber}</strong> —{" "}
          <Link href="/manifests" style={{ color: "#0070f3" }}>look it up</Link>
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="wasteLineIds" value={wasteIds.join(",")} />

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px" }}>Generator</legend>
          <div style={row}>
            <div style={field}>
              <label style={label}>EPA Site ID</label>
              <input name="generatorEpaSiteId" required defaultValue="VAD000532119" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Name</label>
              <input name="generatorName" required defaultValue="TEST TSDF OF VA" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact first name</label>
              <input name="generatorFirstName" required defaultValue="Test" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Contact last name</label>
              <input name="generatorLastName" required defaultValue="Contact" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact phone</label>
              <input name="generatorPhone" required defaultValue="703-555-0100" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Contact email</label>
              <input name="generatorEmail" type="email" defaultValue="test-contact@example.com" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Emergency phone</label>
              <input name="generatorEmergencyPhone" required defaultValue="703-555-0199" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={{ ...field, flex: 2 }}>
              <label style={label}>Address</label>
              <input name="generatorAddress1" required defaultValue="123 MAIN ST" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>City</label>
              <input name="generatorCity" required defaultValue="ARLINGTON" style={inputStyle} />
            </div>
            <div style={{ ...field, flex: 0.5 }}>
              <label style={label}>State</label>
              <input name="generatorState" required defaultValue="VA" style={inputStyle} />
            </div>
            <div style={{ ...field, flex: 0.7 }}>
              <label style={label}>Zip</label>
              <input name="generatorZip" required defaultValue="22202" style={inputStyle} />
            </div>
          </div>
        </fieldset>

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px" }}>Transporter</legend>
          <div style={row}>
            <div style={field}>
              <label style={label}>EPA Site ID</label>
              <input name="transporterEpaSiteId" required defaultValue="VATEST000001" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Name</label>
              <input name="transporterName" required defaultValue="TEST TRANSPORTER 1 OF VA" style={inputStyle} />
            </div>
          </div>
        </fieldset>

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px" }}>Designated facility</legend>
          <div style={row}>
            <div style={field}>
              <label style={label}>EPA Site ID</label>
              <input name="facilityEpaSiteId" required defaultValue="VAD000532119" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Name</label>
              <input name="facilityName" required defaultValue="TEST TSDF OF VA" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact first name</label>
              <input name="facilityFirstName" required defaultValue="Test" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Contact last name</label>
              <input name="facilityLastName" required defaultValue="Contact" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact phone</label>
              <input name="facilityPhone" required defaultValue="703-555-0100" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Contact email</label>
              <input name="facilityEmail" type="email" defaultValue="test-contact@example.com" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Emergency phone</label>
              <input name="facilityEmergencyPhone" required defaultValue="703-555-0199" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={{ ...field, flex: 2 }}>
              <label style={label}>Address</label>
              <input name="facilityAddress1" required defaultValue="123 MAIN ST" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>City</label>
              <input name="facilityCity" required defaultValue="ARLINGTON" style={inputStyle} />
            </div>
            <div style={{ ...field, flex: 0.5 }}>
              <label style={label}>State</label>
              <input name="facilityState" required defaultValue="VA" style={inputStyle} />
            </div>
            <div style={{ ...field, flex: 0.7 }}>
              <label style={label}>Zip</label>
              <input name="facilityZip" required defaultValue="22202" style={inputStyle} />
            </div>
          </div>
        </fieldset>

        {wasteIds.map((id, index) => (
          <fieldset
            key={id}
            style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}
          >
            <legend style={{ padding: "0 8px" }}>
              Waste line {index + 1}
              {index < 4
                ? " (main form)"
                : ` (continuation sheet ${Math.ceil((index - 3) / 7)}, item ${
                    ((index - 4) % 7) + 5
                  })`}
            </legend>

            <div style={field}>
              <label style={label}>
                <input
                  name={`dotHazardous_${id}`}
                  type="checkbox"
                  defaultChecked
                  style={{ marginRight: "6px" }}
                />
                Hazardous (DOT)
              </label>
            </div>

            <div style={field}>
              <label style={label}>Printed DOT information (full shipping description)</label>
              <textarea
                name={`printedDotInformation_${id}`}
                required
                rows={4}
                defaultValue={DEFAULT_WASTE.printedDotInformation}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={row}>
              <div style={field}>
                <label style={label}>DOT ID number code</label>
                <input
                  name={`idNumberCode_${id}`}
                  required
                  defaultValue={DEFAULT_WASTE.idNumberCode}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Federal waste code (optional)</label>
                <input
                  name={`federalWasteCode_${id}`}
                  defaultValue={DEFAULT_WASTE.federalWasteCode}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={row}>
              <div style={field}>
                <label style={label}>Quantity</label>
                <input
                  name={`quantity_${id}`}
                  type="number"
                  required
                  defaultValue={DEFAULT_WASTE.quantity}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Unit code</label>
                <input
                  name={`unitCode_${id}`}
                  required
                  defaultValue={DEFAULT_WASTE.unitCode}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Container count</label>
                <input
                  name={`containerNumber_${id}`}
                  type="number"
                  required
                  defaultValue={DEFAULT_WASTE.containerNumber}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Container type code</label>
                <input
                  name={`containerTypeCode_${id}`}
                  required
                  defaultValue={DEFAULT_WASTE.containerTypeCode}
                  style={inputStyle}
                />
              </div>
            </div>

            {wasteIds.length > 1 && (
              <button
                type="button"
                onClick={() => removeWasteLine(id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#c00",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Remove this waste line
              </button>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          onClick={addWasteLine}
          style={{
            marginBottom: "20px",
            padding: "8px 16px",
            backgroundColor: "white",
            color: "#0070f3",
            border: "1px solid #0070f3",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          + Add waste line
        </button>

        <div style={{ marginBottom: "20px" }}>
          <label style={label}>Special handling instructions (optional, Box 14)</label>
          <textarea
            name="handlingInstructions"
            rows={3}
            defaultValue="Keep upright. Do not stack. Driver call site 30 min prior to arrival."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "10px 20px",
            backgroundColor: isPending ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Saving..." : "Save manifest"}
        </button>
      </form>
    </div>
  );
}
