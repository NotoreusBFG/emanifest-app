"use client";

import { useActionState } from "react";
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

export default function NewManifestPage() {
  const [state, formAction, isPending] = useActionState<CreateManifestState, FormData>(
    createManifestAction,
    null
  );

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>
        <Link href="/manifests" style={{ color: "#0070f3" }}>← Look up a manifest</Link>
      </p>
      <h1>Create a new manifest</h1>
      <p style={{ color: "#666" }}>
        Preprod sandbox only. Fields are pre-filled with known-good EPA test sites — edit as
        needed.
      </p>

      {state && !state.success && <p style={{ color: "red" }}>❌ {state.error}</p>}
      {state && state.success && (
        <p style={{ color: "green" }}>
          ✅ Saved as <strong>{state.manifestTrackingNumber}</strong> —{" "}
          <Link href="/manifests" style={{ color: "#0070f3" }}>look it up</Link>
        </p>
      )}

      <form action={formAction}>
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

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px" }}>Waste line 1</legend>
          <div style={field}>
            <label style={label}>
              <input name="dotHazardous" type="checkbox" defaultChecked style={{ marginRight: "6px" }} />
              Hazardous (DOT)
            </label>
          </div>
          <div style={field}>
            <label style={label}>Printed DOT information (full shipping description)</label>
            <input
              name="printedDotInformation"
              required
              defaultValue="RQ, Waste flammable liquids, n.o.s. (contains xylene), 3, UN1993, PG II"
              style={inputStyle}
            />
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>DOT ID number code</label>
              <input name="idNumberCode" required defaultValue="UN1993" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Federal waste code (optional)</label>
              <input name="federalWasteCode" defaultValue="D001" style={inputStyle} />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Quantity</label>
              <input name="quantity" type="number" required defaultValue="1" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Unit code</label>
              <input name="unitCode" required defaultValue="P" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Container count</label>
              <input name="containerNumber" type="number" required defaultValue="1" style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Container type code</label>
              <input name="containerTypeCode" required defaultValue="DM" style={inputStyle} />
            </div>
          </div>
        </fieldset>

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
