"use client";

import { brandGradient } from "@/lib/brandColors";

/** Browser print (Save as PDF from the print dialog) rather than a real
 * generated PDF -- no PDF library exists in this project yet (see
 * "ldr schema.md"'s status section). The page's print stylesheet hides
 * everything except the notice content itself. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print"
      style={{
        background: brandGradient,
        color: "white",
        border: "none",
        borderRadius: "6px",
        padding: "8px 16px",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      Print / Save as PDF
    </button>
  );
}
