/**
 * ManifestMate brand palette — kept in sync with the Tailwind theme tokens
 * in globals.css (brand-blue/brand-green/brand-teal/brand-navy/brand-tint).
 * This copy exists for pages still using inline styles rather than
 * Tailwind classes.
 */
export const brand = {
  blue: "#0058b8",
  green: "#24bc90",
  teal: "#28ac98",
  navy: "#0a2246",
  tint: "#e8eef4",
} as const;

export const brandGradient = `linear-gradient(to right, ${brand.blue}, ${brand.green})`;
