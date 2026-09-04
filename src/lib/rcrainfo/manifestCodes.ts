/**
 * Unit-of-measure and container-type codes from EPA's Uniform Hazardous
 * Waste Manifest (Form 8700-22) instructions -- Items 11/12. This is the
 * standard published code set, not something pulled from a live API
 * response, so treat it the same way MANIFEST_SCHEMA.md flags its own
 * container-type table: only `P` (Pounds) and `DM` (Metal drums) are
 * actually confirmed against the live preprod API so far (see
 * manifest-fixtures.ts and MANIFEST_SCHEMA.md) -- the rest are believed
 * correct from EPA's own documentation but unverified live. If RCRAInfo
 * ever rejects one of these, trust the error response over this list per
 * this project's usual rule (README.md).
 */

export interface ManifestCode {
  code: string;
  label: string;
}

export const UNIT_CODES: ManifestCode[] = [
  { code: "G", label: "G — Gallons" },
  { code: "L", label: "L — Liters" },
  { code: "P", label: "P — Pounds" },
  { code: "K", label: "K — Kilograms" },
  { code: "T", label: "T — Tons (short, 2,000 lb)" },
  { code: "M", label: "M — Metric tons (1,000 kg)" },
  { code: "Y", label: "Y — Cubic yards" },
  { code: "N", label: "N — Cubic meters" },
];

export const CONTAINER_TYPE_CODES: ManifestCode[] = [
  { code: "DM", label: "DM — Metal drum, barrel, or keg" },
  { code: "DF", label: "DF — Fiber or plastic drum" },
  { code: "DW", label: "DW — Wooden drum, barrel, or keg" },
  { code: "CM", label: "CM — Metal box, carton, or case" },
  { code: "CF", label: "CF — Fiber or plastic box, carton, or case" },
  { code: "CW", label: "CW — Wooden box, carton, or case" },
  { code: "BA", label: "BA — Burlap, cloth, paper, or plastic bag" },
  { code: "CY", label: "CY — Cylinder" },
  { code: "TT", label: "TT — Cargo tank (tank truck)" },
  { code: "TC", label: "TC — Tank car" },
  { code: "TP", label: "TP — Portable tank" },
  { code: "DT", label: "DT — Dump truck" },
  { code: "HG", label: "HG — Hopper or gondola car" },
];
