/**
 * Full 40 CFR 268.7(a)(4) "how must this waste be managed" letter set —
 * text transcribed from a real industry LDR form (US Ecology's) reviewed
 * with the user 2026-07-26/27, cross-referenced against the regulation's
 * own wording. Snapshotted into `ldr_notices.certifications` at signing
 * time rather than trusted as a client-supplied value, same reasoning as
 * signature_consents. Soil (letter S) deliberately excluded — out of
 * scope per the user's explicit "build out A-I" go-ahead.
 */
import type { LdrManagementLetter } from "./types";

export interface LdrManagementOption {
  letter: LdrManagementLetter;
  /** Short label for the per-waste-line picker. */
  shortLabel: string;
  heading: string;
  text: string;
  /** Whether choosing this letter requires a signed certification
   * (C, D, E, F, G, I) vs. a notice-only statement (A, B, H). */
  requiresCertification: boolean;
}

export const LDR_MANAGEMENT_OPTIONS: Record<LdrManagementLetter, LdrManagementOption> = {
  A: {
    letter: "A",
    shortLabel: "A — Requires treatment to the applicable standard",
    heading: "A — Requires treatment to the applicable standard",
    requiresCertification: false,
    text:
      "This waste must be treated to the applicable performance-based treatment standard set forth in " +
      "40 CFR Part 268 Subpart C and Subpart D, 268.40, or RCRA Section 3004(d) prior to land disposal.",
  },
  B: {
    letter: "B",
    shortLabel: "B — Hazardous debris, alternative standard (268.45)",
    heading: "B — Hazardous debris, alternative treatment standard",
    requiresCertification: false,
    text: "This hazardous debris is subject to the alternative treatment standards of 40 CFR 268.45.",
  },
  C: {
    letter: "C",
    shortLabel: "C — Treated to performance standards",
    heading: "C — Treated to the performance standards",
    requiresCertification: true,
    text:
      "I certify under penalty of law that I have personally examined and am familiar with the technology and " +
      "operation of the treatment process used to support this certification. Based on my inquiry of those " +
      "individuals immediately responsible for obtaining this information, I believe that the treatment process " +
      "has been operated and maintained properly so as to comply with the treatment standards specified in 40 " +
      "CFR 268.40 without impermissible dilution of the prohibited waste. I am aware there are significant " +
      "penalties for submitting a false certification, including the possibility of a fine and imprisonment.",
  },
  D: {
    letter: "D",
    shortLabel: "D — Meets standard, no treatment needed",
    heading: "D — Meets the treatment standard, no treatment needed",
    requiresCertification: true,
    text:
      "I certify under penalty of law that I personally have examined and am familiar with the waste through " +
      "analysis and testing or through knowledge of the waste to support this certification that the waste " +
      "complies with the treatment standards specified in 40 CFR part 268 subpart D. I believe that the " +
      "information I submitted is true, accurate, and complete. I am aware that there are significant penalties " +
      "for submitting a false certification, including the possibility of a fine and imprisonment.",
  },
  E: {
    letter: "E",
    shortLabel: "E — Lab pack (268.42(c))",
    heading: "E — Lab pack (40 CFR 268.42(c))",
    requiresCertification: true,
    text:
      "I certify under penalty of law that I personally have examined and am familiar with the waste and that " +
      "this lab pack contains only wastes that have not been excluded under appendix IV to 40 CFR part 268 and " +
      "that this lab pack will be sent to a combustion facility in compliance with the alternative treatment " +
      "standards for lab packs at 40 CFR 268.42(c). I am aware that there are significant penalties for " +
      "submitting a false certification, including the possibility of fine or imprisonment.",
  },
  F: {
    letter: "F",
    shortLabel: "F — Decharacterized, underlying constituents still need treatment",
    heading: "F — Decharacterized; underlying constituents still need treatment",
    requiresCertification: true,
    text:
      "I certify under penalty of law that the waste has been treated in accordance with the requirements of " +
      "40 CFR 268.40 or 268.49 to remove the hazardous characteristic. This decharacterized waste contains " +
      "underlying hazardous constituents that require further treatment to meet treatment standards. I am " +
      "aware that there are significant penalties for submitting a false certification, including the " +
      "possibility of fine and imprisonment.",
  },
  G: {
    letter: "G",
    shortLabel: "G — Decharacterized, underlying constituents already treated",
    heading: "G — Decharacterized; underlying constituents already treated",
    requiresCertification: true,
    text:
      "I certify under penalty of law that the waste has been treated in accordance with the requirements of " +
      "40 CFR 268.40 to remove the hazardous characteristic and that underlying hazardous constituents, as " +
      "defined in §268.2(i), have been treated on-site to meet the §268.48 Universal Treatment " +
      "Standards. I am aware that there are significant penalties for submitting a false certification, " +
      "including the possibility of fine and imprisonment.",
  },
  H: {
    letter: "H",
    shortLabel: "H — Exempt from land disposal",
    heading: "H — Exempt from land disposal",
    requiresCertification: false,
    text:
      "This waste is subject to an exemption from a prohibition on the type of land disposal method utilized " +
      "for the waste (such as, but not limited to, a case-by-case extension under 40 CFR 268.5, an exemption " +
      "under 40 CFR 268.6, or a nationwide capacity variance under 40 CFR 268 Subpart C). Include the date the " +
      "waste became subject to the prohibition.",
  },
  I: {
    letter: "I",
    shortLabel: "I — Concentration standard, analytical detection limit alternative",
    heading: "I — Concentration-based standard, analytical detection limit alternative",
    requiresCertification: true,
    text:
      "I certify under penalty of law that I have personally examined and am familiar with the treatment " +
      "technology and operation of the treatment process used to support this certification. Based on my " +
      "inquiry of those individuals immediately responsible for obtaining this information, I believe the " +
      "nonwastewater organic constituents have been treated by combustion units as specified in 268.42, Table " +
      "1. I have been unable to detect the nonwastewater organic constituents, despite having used best " +
      "good-faith efforts to analyze for such constituents. I am aware there are significant penalties for " +
      "submitting a false certification, including the possibility of fine and imprisonment.",
  },
};

export const LDR_MANAGEMENT_LETTERS: LdrManagementLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
