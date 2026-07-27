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

/**
 * Manifest lifecycle status-badge colors — from the MM1.1 design handoff
 * (design-handoff/mm1.1/README.md). Not derived from the core brand
 * palette above; kept alongside it as the single source of truth for
 * badge coloring across the app.
 */
export const badgeColors = {
  scheduled: { bg: "#e9eef4", text: "#0a2246" },
  in_transit: { bg: "#fdf3e3", text: "#a15c00" },
  overdue: { bg: "#fdecea", text: "#c0392b" },
  received: { bg: "#e6f8f1", text: "#178a63" },
  rejected: { bg: "#f4e3fb", text: "#8a2fa1" },
} as const;
