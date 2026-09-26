import type { ReactNode } from "react";
import { brand } from "@/lib/brandColors";

/**
 * Shared full-screen overlay + centered card, one per guided-setup step.
 * Same dialog semantics as ChemicalQuickAddModal
 * (src/components/LabPackFormFields.tsx) but in this file's own
 * inline-style convention (manifests/new/* isn't on Tailwind), since these
 * modals sit directly alongside ManifestFieldsForm.
 */
export function WizardModalShell({
  title,
  step,
  totalSteps,
  onClose,
  children,
}: {
  title: string;
  step: number;
  totalSteps: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 34, 70, 0.5)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "8px",
          background: "white",
          padding: "20px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ margin: 0, color: brand.navy, fontSize: "18px" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "18px" }}
            aria-label="Close guided setup"
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#888" }}>
          Step {step} of {totalSteps}
        </p>
        {children}
      </div>
    </div>
  );
}
