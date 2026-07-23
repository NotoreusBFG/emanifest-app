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

const MAIN_PAGE_LINE_COUNT = 4;
const CONTINUATION_SHEET_LINE_COUNT = 7;

function continuationLabel(index: number): string {
  if (index < MAIN_PAGE_LINE_COUNT) return "main form";
  const sheetNumber = Math.ceil((index - MAIN_PAGE_LINE_COUNT + 1) / CONTINUATION_SHEET_LINE_COUNT);
  return `continuation sheet ${sheetNumber}`;
}

export default function NewManifestPage() {
  const [state, formAction, isPending] = useActionState<CreateManifestState, FormData>(
    createManifestAction,
    null
  );
  const [wasteIds, setWasteIds] = useState<number[]>([0, 1, 2, 3]);
  const [hazardousMap, setHazardousMap] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
  });

  const addContinuationPage = () => {
    const nextId = wasteIds.length ? Math.max(...wasteIds) + 1 : 0;
    const newIds = Array.from({ length: CONTINUATION_SHEET_LINE_COUNT }, (_, i) => nextId + i);
    setWasteIds((ids) => [...ids, ...newIds]);
    setHazardousMap((map) => {
      const next = { ...map };
      newIds.forEach((id) => (next[id] = true));
      return next;
    });
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
        Preprod sandbox only. Fields are pre-filled with a known-good EPA test site — edit as
        needed. Empty waste-line slots are skipped automatically, so it&apos;s fine to leave most
        of the 4 main-form slots blank.
      </p>

      {state && !state.success && <p style={{ color: "red" }}>❌ {state.error}</p>}
      {state && state.success && (
        <div style={{ border: "1px solid #cde9cd", borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
          <p style={{ color: "green", margin: 0 }}>
            ✅ Saved as <strong>{state.manifestTrackingNumber}</strong> —{" "}
            <Link href="/manifests" style={{ color: "#0070f3" }}>look it up</Link>
          </p>
          {state.warnings.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#946c00" }}>
                RCRAInfo warnings (data was still saved — check these weren&apos;t mistakes):
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#946c00", fontSize: "14px" }}>
                {state.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
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

        {wasteIds.map((id, index) => {
          const isHazardous = hazardousMap[id] ?? true;
          return (
            <fieldset
              key={id}
              style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}
            >
              <legend style={{ padding: "0 8px" }}>
                Waste line {index + 1} ({continuationLabel(index)})
              </legend>

              <div style={field}>
                <label style={label}>
                  <input
                    name={`dotHazardous_${id}`}
                    type="checkbox"
                    checked={isHazardous}
                    onChange={(e) =>
                      setHazardousMap((map) => ({ ...map, [id]: e.target.checked }))
                    }
                    style={{ marginRight: "6px" }}
                  />
                  Hazardous (DOT)
                </label>
              </div>

              {isHazardous ? (
                <>
                  <div style={field}>
                    <label style={label}>Proper shipping name</label>
                    <textarea
                      name={`properShippingName_${id}`}
                      rows={2}
                      defaultValue={
                        index === 0 ? "Waste flammable liquids, n.o.s. (contains xylene)" : ""
                      }
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                  <div style={row}>
                    <div style={field}>
                      <label style={label}>
                        <input
                          name={`rqIndicator_${id}`}
                          type="checkbox"
                          defaultChecked={index === 0}
                          style={{ marginRight: "6px" }}
                        />
                        RQ (reportable quantity)
                      </label>
                    </div>
                    <div style={field}>
                      <label style={label}>Hazard class</label>
                      <input
                        name={`hazardClass_${id}`}
                        defaultValue={index === 0 ? "3" : ""}
                        style={inputStyle}
                      />
                    </div>
                    <div style={field}>
                      <label style={label}>Packing group</label>
                      <input
                        name={`packingGroup_${id}`}
                        defaultValue={index === 0 ? "II" : ""}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={row}>
                    <div style={field}>
                      <label style={label}>DOT ID number code</label>
                      <input
                        name={`idNumberCode_${id}`}
                        defaultValue={index === 0 ? "UN1993" : ""}
                        style={inputStyle}
                      />
                    </div>
                    <div style={field}>
                      <label style={label}>Federal waste code (optional — leave blank if none)</label>
                      <input
                        name={`federalWasteCode_${id}`}
                        defaultValue={index === 0 ? "D001" : ""}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={field}>
                  <label style={label}>Waste description</label>
                  <input name={`wasteDescription_${id}`} style={inputStyle} />
                </div>
              )}

              <div style={row}>
                <div style={field}>
                  <label style={label}>Quantity</label>
                  <input
                    name={`quantity_${id}`}
                    type="number"
                    defaultValue={index === 0 ? "1" : ""}
                    style={inputStyle}
                  />
                </div>
                <div style={field}>
                  <label style={label}>Unit code</label>
                  <input name={`unitCode_${id}`} defaultValue={index === 0 ? "P" : ""} style={inputStyle} />
                </div>
                <div style={field}>
                  <label style={label}>Container count</label>
                  <input
                    name={`containerNumber_${id}`}
                    type="number"
                    defaultValue={index === 0 ? "1" : ""}
                    style={inputStyle}
                  />
                </div>
                <div style={field}>
                  <label style={label}>Container type code</label>
                  <input
                    name={`containerTypeCode_${id}`}
                    defaultValue={index === 0 ? "DM" : ""}
                    style={inputStyle}
                  />
                </div>
              </div>

              {wasteIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWasteLine(id)}
                  style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", padding: 0 }}
                >
                  Remove this waste line
                </button>
              )}
            </fieldset>
          );
        })}

        <button
          type="button"
          onClick={addContinuationPage}
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
          + Add continuation page ({CONTINUATION_SHEET_LINE_COUNT} more lines)
        </button>

        <div style={{ marginBottom: "20px" }}>
          <label style={label}>
            Special handling instructions (optional — Box 14. RCRAInfo prints this, plus any
            per-line notes, all on page 1 regardless of which page the line is on — there&apos;s
            no separate box per continuation sheet.)
          </label>
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
