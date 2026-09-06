"use client";

import { useRef } from "react";
import { brand, brandGradient } from "@/lib/brandColors";

/** Embeds the existing /bol/[id]/print page in an iframe rather than
 * re-rendering the BOL layout a second time here -- that page already
 * owns the printable markup and its own @media print rules, so printing
 * via the iframe's contentWindow keeps this preview and the print output
 * pixel-identical by construction. */
export function BolPreviewPanel({ bolId }: { bolId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div style={{ marginTop: "10px", padding: "12px 14px", background: brand.tint, borderRadius: "6px", fontSize: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p style={{ margin: 0, fontWeight: 600, color: brand.navy }}>Preview bill of lading</p>
        <button
          type="button"
          onClick={handlePrint}
          style={{
            background: brandGradient,
            color: "white",
            padding: "6px 14px",
            borderRadius: "4px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Print this bill of lading
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={`/bol/${bolId}/print`}
        title="Bill of lading preview"
        style={{ width: "100%", height: "600px", border: "1px solid #ccc", borderRadius: "4px", background: "white" }}
      />
    </div>
  );
}
