/**
 * Land Disposal Restriction (LDR) notice types — 40 CFR 268.7(a). See
 * "ldr schema.md" at the repo root for the regulatory research this is
 * based on, and docs/epa-registration-wizard-design.md-style separation:
 * this is a fully separate ManifestMate-only concept, deliberately NOT
 * merged into src/lib/rcrainfo/types.ts — EPA's e-Manifest API doesn't
 * process these at all (confirmed via EPA's own FAQ), so nothing here maps
 * to an RCRAInfo request/response shape.
 *
 * Redesigned 2026-07-27 around the real "how must this waste be managed"
 * letter set from 40 CFR 268.7(a)(4) (matching a real industry LDR form
 * reviewed with the user), selected PER WASTE LINE rather than one binary
 * Path A/B choice for the whole notice. Soil (letter S, with its own
 * embedded DOES/DOES NOT fill-in-the-blank language) is deliberately out
 * of scope for now — the user greenlit "A-I", not soil.
 */

/** The 9 lettered options from 40 CFR 268.7(a)(4)'s "Generator Paperwork
 * Requirements" table. See certificationText.ts for the actual wording and
 * which letters require a signed certification vs. notice only. Defaults
 * to "A" when creating a new waste line — per the user's own real usage
 * pattern, the overwhelming majority of waste needs letter A, with lab
 * pack (E) the only common alternative. */
export type LdrManagementLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";

export interface LdrWasteLineEntry {
  /** The manifest's own WasteLine.lineNumber, when this entry was prefilled
   * from a real manifest via `?mtn=` — null for a standalone/manually
   * entered line. Plain sequential integer (RCRAInfo's own numbering),
   * not the "11A"/"11B" paper-form item lettering a real LDR form uses —
   * that lettering is Item 11's own paper-form convention, not something
   * our manifest data carries. */
  manifestLineNumber: number | null;
  epaHazardousWasteNumbers: string[]; // e.g. ["D001", "F003"]
  howManaged: LdrManagementLetter;
  constituentsOfConcern?: string;
  wastewaterCategory: "wastewater" | "nonwastewater";
  subdivision?: string; // e.g. "D003 reactive cyanide"
  wasteAnalysisData?: string;
}

/** One signed certification, snapshotted verbatim at signing time (not a
 * reference to "whatever the current text is" — same reasoning as
 * signature_consents). A notice can have several of these at once — e.g.
 * one waste line needing letter D's certification and another needing
 * E's — one entry per distinct letter actually used among its waste lines
 * that requires certification. */
export interface LdrCertification {
  letter: LdrManagementLetter;
  heading: string;
  certificationText: string;
  signedByName: string;
  signedAt: string; // ISO timestamp
}

/** "prepared" -- built through ManifestMate's own structured A-I letter
 * form. "third_party" -- someone else (the receiving facility, a broker, a
 * lab) already prepared the notice; ManifestMate just stores their PDF and
 * tracks which MTN it belongs to. See
 * 20260822_add_third_party_ldr_notices.sql. */
export type LdrNoticeSource = "prepared" | "third_party";

export interface LdrNotice {
  id: string;
  manifestId: string | null;
  epaMtn: string | null;
  /** Null for a third-party notice -- there's no structured pick-a-site
   * step for that path, only a third-party name and (optionally) an MTN. */
  generatorEpaSiteId: string | null;
  receivingFacilityEpaSiteId: string | null;
  receivingFacilityName: string | null;
  wasteLines: LdrWasteLineEntry[];
  wasteCodeKey: string;
  preparedDate: string; // ISO date
  /** Every notice is named and dated regardless of whether any waste
   * line's letter actually triggers a certification (matches real LDR
   * forms) -- distinct from LdrCertification.signedByName, which only
   * exists for letters that require one. Empty for a third-party notice. */
  preparedByName: string;
  certifications: LdrCertification[];
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
  source: LdrNoticeSource;
  /** Who sent/prepared this notice, for a third-party-sourced record only. */
  thirdPartyName: string | null;
}

/** The practical "is this the same waste stream" comparison key — a sorted,
 * comma-joined list of EPA hazardous waste codes across all waste lines on
 * the notice. A proxy, not a legal determination (see migration comment). */
export function computeWasteCodeKey(wasteLines: LdrWasteLineEntry[]): string {
  const codes = new Set<string>();
  for (const line of wasteLines) {
    for (const code of line.epaHazardousWasteNumbers) codes.add(code.trim().toUpperCase());
  }
  return Array.from(codes).sort().join(",");
}
