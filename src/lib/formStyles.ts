/**
 * Shared inline-style objects for the app's plain-inputStyle form pages
 * (login/settings/manifests/manifest-form aren't on Tailwind yet). Pulled
 * out after SignManifestPanel.tsx re-typed the same input/button styles
 * already defined in manifests/page.tsx, the only file that renders it.
 */
import { brandGradient } from "./brandColors";

export const inputStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  boxSizing: "border-box" as const,
};

export function primaryButtonStyle(isPending: boolean) {
  return {
    padding: "8px 16px",
    background: isPending ? "#ccc" : brandGradient,
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontWeight: 600,
    cursor: isPending ? "not-allowed" : ("pointer" as const),
  };
}
