"use client";

import { useState } from "react";
import { CSV_COLUMNS, parseManifestImportFile } from "@/lib/import/parseManifestImport";
import type { ImportedManifestPayload } from "@/lib/import/types";
import { brand } from "@/lib/brandColors";

const TEMPLATE_EXAMPLE_ROW = [
  "VAD000532119",
  "TEST GENERATOR",
  "VATEST000001",
  "TEST TRANSPORTER 1 OF VA",
  "",
  "",
  "VAD000532119",
  "TEST TSDF OF VA",
  '"Waste flammable liquids, n.o.s. (contains xylene)"',
  "true",
  "3",
  "II",
  "UN1993",
  "false",
  "10",
  "P",
  "1",
  "DM",
  "D001;F003",
].join(",");

function downloadCsvTemplate() {
  const csv = `${CSV_COLUMNS.join(",")}\n${TEMPLATE_EXAMPLE_ROW}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manifestmate-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Manifest data import -- Option B from docs/manifest-data-import-design.md
 * (a generator's own ERP/LIMS export). Parses entirely client-side (no
 * server round-trip needed just to read a file) and only ever populates
 * the existing form state via `onImport`, exactly as if a human had typed
 * it -- nothing here touches EPA. Options A (broker submission) and C
 * (general third-party API) are deliberately not built; see the design
 * doc.
 */
export function ImportManifestData({ onImport }: { onImport: (payload: ImportedManifestPayload) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setErrors(null);
    setImported(false);
    setFileName(file.name);

    const text = await file.text();
    const result = parseManifestImportFile(file.name, text);
    setIsParsing(false);

    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    onImport(result.payload);
    setImported(true);
  };

  return (
    <div style={{ border: `1px dashed ${brand.blue}`, borderRadius: "8px", padding: "14px 16px", marginBottom: "20px" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 600, color: brand.navy, fontSize: "14px" }}>
        Import from file (optional)
      </p>
      <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#666" }}>
        Upload a .csv or .json export from your own system to pre-fill the fields below — nothing
        is submitted to EPA until you review and save as usual.
      </p>
      <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".csv,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          style={{ fontSize: "13px" }}
        />
        <button
          type="button"
          onClick={downloadCsvTemplate}
          style={{ background: "none", border: "none", color: brand.blue, cursor: "pointer", fontSize: "13px", padding: 0 }}
        >
          Download CSV template
        </button>
      </div>
      {isParsing && <p style={{ fontSize: "13px", color: "#666", marginTop: "8px" }}>Parsing {fileName}…</p>}
      {errors && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "13px", color: "#c0392b", fontWeight: 600, margin: 0 }}>
            Couldn&apos;t import {fileName}:
          </p>
          <ul style={{ margin: "4px 0 0", paddingLeft: "20px", fontSize: "12.5px", color: "#c0392b" }}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {imported && !errors && (
        <p style={{ fontSize: "13px", color: brand.green, marginTop: "8px" }}>
          ✅ Imported from {fileName} — review the fields below, then save as usual.
        </p>
      )}
    </div>
  );
}
