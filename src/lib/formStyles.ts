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
  // Without an explicit color, some mobile browsers (seen on the phone-
  // number field of the accountless invite panels) render typed input text
  // in a light, hard-to-read grey instead of the OS default black.
  color: "#000",
  fontWeight: 600,
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

/**
 * Same gradient treatment as primaryButtonStyle, for a page-level primary
 * CTA rendered as a <Link> (pure navigation, no pending/submit state) --
 * e.g. "Create manifest" / "Make a BOL" in a page's top-right corner.
 */
export const primaryLinkButtonStyle = {
  display: "inline-block",
  padding: "8px 16px",
  background: brandGradient,
  color: "white",
  borderRadius: "4px",
  fontWeight: 600,
  textDecoration: "none" as const,
};
