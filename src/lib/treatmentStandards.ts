/**
 * 40 CFR 268.40 treatment standards for the RCRA hazardous waste
 * CHARACTERISTIC codes (D001-D043) only — the full table also covers
 * hundreds of F/K/P/U-listed codes, deliberately out of scope for now
 * (see "ldr schema.md" at the repo root for the scoping decision).
 *
 * NOT authoritative and NOT independently re-verified against the primary
 * eCFR text — compiled from a single fetch of Cornell LII's CFR mirror
 * (law.cornell.edu/cfr/text/40/268.40), processed through a summarization
 * step. Same caution as src/lib/wasteCodeReference.ts: treat this as a
 * strong starting reference, not production-grade compliance data, until
 * spot-checked against the actual regulation.
 *
 * This does NOT let the app auto-derive which LDR letter (A-I) applies —
 * whether a given batch of waste already meets its standard (letter D) or
 * still needs treatment (letter A) is a fact about that specific waste,
 * not something derivable from the code alone. What this DOES enable:
 * showing the real applicable standard as context, and the actual
 * regulated constituent name/subcategory language instead of free text.
 */

export interface TreatmentStandardEntry {
  code: string;
  /** Human label for this row when a code has more than one subcategory
   * (e.g. D001's "High TOC" subcategory, D003's several reactive-waste
   * buckets, D009's mercury-content tiers). Undefined for a code with a
   * single, unqualified standard. */
  subcategory?: string;
  /** The regulated hazardous constituent name + CAS number, for the
   * toxicity-characteristic codes (D004-D043) — this IS the LDR notice's
   * "constituents of concern" for a characteristic waste, not something
   * separate. Undefined for D001-D003 (property-based, not a specific
   * constituent). */
  regulatedConstituent?: string;
  wastewaterStandard?: string;
  nonwastewaterStandard?: string;
  /** Set when a standard applies without a wastewater/nonwastewater split
   * (e.g. several of D003's subcategories). */
  bothStandard?: string;
  notes?: string;
}

export const D_CODE_TREATMENT_STANDARDS: TreatmentStandardEntry[] = [
  {
    code: "D001",
    subcategory: "General (except High TOC Subcategory)",
    wastewaterStandard: "DEACT and meet § 268.48 standards; or RORGS; or CMBST",
    nonwastewaterStandard: "DEACT and meet § 268.48 standards; or RORGS; or CMBST",
  },
  {
    code: "D001",
    subcategory: "High TOC Ignitable Characteristic Liquids Subcategory (40 CFR 261.21(a)(1), ≥10% total organic carbon) — nonwastewaters only",
    nonwastewaterStandard: "RORGS; CMBST; or POLYM",
  },
  {
    code: "D002",
    wastewaterStandard: "DEACT and meet § 268.48 standards",
    nonwastewaterStandard: "DEACT and meet § 268.48 standards",
  },
  {
    code: "D003",
    subcategory: "Reactive Sulfides (40 CFR 261.23(a)(5))",
    bothStandard: "DEACT",
  },
  {
    code: "D003",
    subcategory: "Explosives (40 CFR 261.23(a)(6), (7), and (8))",
    bothStandard: "DEACT and meet § 268.48 standards",
  },
  {
    code: "D003",
    subcategory: "Unexploded ordnance",
    bothStandard: "DEACT",
  },
  {
    code: "D003",
    subcategory: "Other reactives (40 CFR 261.23(a)(1))",
    bothStandard: "DEACT and meet § 268.48 standards",
  },
  {
    code: "D003",
    subcategory: "Water reactive (40 CFR 261.23(a)(2), (3), and (4)) — nonwastewaters only",
    nonwastewaterStandard: "DEACT and meet § 268.48 standards",
  },
  {
    code: "D003",
    subcategory: "Reactive cyanides (40 CFR 261.23(a)(5)) — Total",
    wastewaterStandard: "Reserved",
    nonwastewaterStandard: "590 mg/kg",
  },
  {
    code: "D003",
    subcategory: "Reactive cyanides (40 CFR 261.23(a)(5)) — Amenable",
    wastewaterStandard: "0.86 mg/L",
    nonwastewaterStandard: "30 mg/kg",
  },
  {
    code: "D004",
    regulatedConstituent: "Arsenic (CAS 7440-38-2)",
    wastewaterStandard: "1.4 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.0 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D005",
    regulatedConstituent: "Barium (CAS 7440-39-3)",
    wastewaterStandard: "1.2 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "21 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D006",
    subcategory: "General",
    regulatedConstituent: "Cadmium (CAS 7440-43-9)",
    wastewaterStandard: "0.69 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.11 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D006",
    subcategory: "Cadmium containing batteries — nonwastewaters only",
    nonwastewaterStandard: "RTHRM",
  },
  {
    code: "D006",
    subcategory: "Radioactively contaminated cadmium containing batteries — nonwastewaters only",
    nonwastewaterStandard: "Macroencapsulation in accordance with 40 CFR 268.45",
  },
  {
    code: "D007",
    regulatedConstituent: "Chromium (Total) (CAS 7440-47-3)",
    wastewaterStandard: "2.77 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.60 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D008",
    subcategory: "General",
    regulatedConstituent: "Lead (CAS 7439-92-1)",
    wastewaterStandard: "0.69 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.75 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D008",
    subcategory: "Lead acid batteries — nonwastewaters only",
    nonwastewaterStandard: "RLEAD",
  },
  {
    code: "D008",
    subcategory: "Radioactive lead solids — nonwastewaters only",
    nonwastewaterStandard: "MACRO",
  },
  {
    code: "D009",
    subcategory: "High Mercury-Organic (≥260 mg/kg total mercury, contains organics) — nonwastewaters only",
    nonwastewaterStandard: "IMERC; OR RMERC",
    regulatedConstituent: "Mercury (CAS 7439-97-6)",
  },
  {
    code: "D009",
    subcategory: "High Mercury-Inorganic (≥260 mg/kg total mercury, inorganic) — nonwastewaters only",
    nonwastewaterStandard: "RMERC",
    regulatedConstituent: "Mercury (CAS 7439-97-6)",
  },
  {
    code: "D009",
    subcategory: "Low Mercury (<260 mg/kg, residues from RMERC) — nonwastewaters only",
    nonwastewaterStandard: "0.20 mg/L TCLP and meet § 268.48 standards",
    regulatedConstituent: "Mercury (CAS 7439-97-6)",
  },
  {
    code: "D009",
    subcategory: "Low Mercury (<260 mg/kg, not residues from RMERC) — nonwastewaters only",
    nonwastewaterStandard: "0.025 mg/L TCLP and meet § 268.48 standards",
    regulatedConstituent: "Mercury (CAS 7439-97-6)",
  },
  {
    code: "D009",
    subcategory: "All D009 wastewaters",
    wastewaterStandard: "0.15 mg/L TCLP and meet § 268.48 standards",
    regulatedConstituent: "Mercury (CAS 7439-97-6)",
  },
  {
    code: "D009",
    subcategory: "Elemental mercury contaminated with radioactive materials — nonwastewaters only",
    nonwastewaterStandard: "AMLGM",
  },
  {
    code: "D009",
    subcategory: "Hydraulic oil contaminated with mercury radioactive materials — nonwastewaters only",
    nonwastewaterStandard: "IMERC",
  },
  {
    code: "D009",
    subcategory: "Radioactively contaminated mercury containing batteries — nonwastewaters only",
    nonwastewaterStandard: "Macroencapsulation in accordance with 40 CFR 268.45",
  },
  {
    code: "D010",
    regulatedConstituent: "Selenium (CAS 7782-49-2)",
    wastewaterStandard: "0.82 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.7 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D011",
    subcategory: "General",
    regulatedConstituent: "Silver (CAS 7440-22-4)",
    wastewaterStandard: "0.43 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.14 mg/L TCLP and meet § 268.48 standards",
  },
  {
    code: "D011",
    subcategory: "Radioactively contaminated silver containing batteries — nonwastewaters only",
    nonwastewaterStandard: "Macroencapsulation in accordance with 40 CFR 268.45",
  },
  {
    code: "D012",
    subcategory: "Endrin",
    regulatedConstituent: "Endrin (CAS 72-20-8)",
    wastewaterStandard: "BIODG; or CMBST",
    nonwastewaterStandard: "0.13 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D012",
    subcategory: "Endrin aldehyde",
    regulatedConstituent: "Endrin aldehyde (CAS 7421-93-4)",
    wastewaterStandard: "BIODG; or CMBST",
    nonwastewaterStandard: "0.13 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D013",
    subcategory: "alpha-BHC",
    regulatedConstituent: "alpha-BHC (CAS 319-84-6)",
    wastewaterStandard: "CARBN; or CMBST",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D013",
    subcategory: "beta-BHC",
    regulatedConstituent: "beta-BHC (CAS 319-85-7)",
    wastewaterStandard: "CARBN; or CMBST",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D013",
    subcategory: "delta-BHC",
    regulatedConstituent: "delta-BHC (CAS 319-86-8)",
    wastewaterStandard: "CARBN; or CMBST",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D013",
    subcategory: "gamma-BHC (Lindane)",
    regulatedConstituent: "gamma-BHC / Lindane (CAS 58-89-9)",
    wastewaterStandard: "CARBN; or CMBST",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D014",
    regulatedConstituent: "Methoxychlor (CAS 72-43-5)",
    wastewaterStandard: "WETOX or CMBST",
    nonwastewaterStandard: "0.18 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D015",
    regulatedConstituent: "Toxaphene (CAS 8001-35-2)",
    wastewaterStandard: "BIODG or CMBST",
    nonwastewaterStandard: "2.6 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D016",
    regulatedConstituent: "2,4-D / 2,4-Dichlorophenoxyacetic acid (CAS 94-75-7)",
    wastewaterStandard: "CHOXD, BIODG, or CMBST",
    nonwastewaterStandard: "10 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D017",
    regulatedConstituent: "2,4,5-TP / Silvex (CAS 93-72-1)",
    wastewaterStandard: "CHOXD or CMBST",
    nonwastewaterStandard: "7.9 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D018",
    regulatedConstituent: "Benzene (CAS 71-43-2)",
    wastewaterStandard: "0.14 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "10 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D019",
    regulatedConstituent: "Carbon tetrachloride (CAS 56-23-5)",
    wastewaterStandard: "0.057 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D020",
    regulatedConstituent: "Chlordane, alpha and gamma isomers (CAS 57-74-9)",
    wastewaterStandard: "0.0033 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.26 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D021",
    regulatedConstituent: "Chlorobenzene (CAS 108-90-7)",
    wastewaterStandard: "0.057 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D022",
    regulatedConstituent: "Chloroform (CAS 67-66-3)",
    wastewaterStandard: "0.046 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D023",
    regulatedConstituent: "o-Cresol (CAS 95-48-7)",
    wastewaterStandard: "0.11 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.6 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D024",
    regulatedConstituent: "m-Cresol (CAS 108-39-4)",
    wastewaterStandard: "0.77 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.6 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D025",
    regulatedConstituent: "p-Cresol (CAS 106-44-5)",
    wastewaterStandard: "0.77 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.6 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D026",
    regulatedConstituent: "Cresol, mixed isomers / Cresylic acid (CAS 1319-77-3)",
    wastewaterStandard: "0.88 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "11.2 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D027",
    regulatedConstituent: "p-Dichlorobenzene / 1,4-Dichlorobenzene (CAS 106-46-7)",
    wastewaterStandard: "0.090 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D028",
    regulatedConstituent: "1,2-Dichloroethane (CAS 107-06-2)",
    wastewaterStandard: "0.21 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D029",
    regulatedConstituent: "1,1-Dichloroethylene (CAS 75-35-4)",
    wastewaterStandard: "0.025 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D030",
    regulatedConstituent: "2,4-Dinitrotoluene (CAS 121-14-2)",
    wastewaterStandard: "0.32 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "140 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D031",
    subcategory: "Heptachlor",
    regulatedConstituent: "Heptachlor (CAS 76-44-8)",
    wastewaterStandard: "0.0012 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D031",
    subcategory: "Heptachlor epoxide",
    regulatedConstituent: "Heptachlor epoxide (CAS 1024-57-3)",
    wastewaterStandard: "0.016 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "0.066 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D032",
    regulatedConstituent: "Hexachlorobenzene (CAS 118-74-1)",
    wastewaterStandard: "0.055 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "10 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D033",
    regulatedConstituent: "Hexachlorobutadiene (CAS 87-68-3)",
    wastewaterStandard: "0.055 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "5.6 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D034",
    regulatedConstituent: "Hexachloroethane (CAS 67-72-1)",
    wastewaterStandard: "0.055 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "30 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D035",
    regulatedConstituent: "Methyl ethyl ketone (CAS 78-93-3)",
    wastewaterStandard: "0.28 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "36 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D036",
    regulatedConstituent: "Nitrobenzene (CAS 98-95-3)",
    wastewaterStandard: "0.068 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "14 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D037",
    regulatedConstituent: "Pentachlorophenol (CAS 87-86-5)",
    wastewaterStandard: "0.089 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "7.4 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D038",
    regulatedConstituent: "Pyridine (CAS 110-86-1)",
    wastewaterStandard: "0.014 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "16 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D039",
    regulatedConstituent: "Tetrachloroethylene (CAS 127-18-4)",
    wastewaterStandard: "0.056 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D040",
    regulatedConstituent: "Trichloroethylene (CAS 79-01-6)",
    wastewaterStandard: "0.054 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D041",
    regulatedConstituent: "2,4,5-Trichlorophenol (CAS 95-95-4)",
    wastewaterStandard: "0.18 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "7.4 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D042",
    regulatedConstituent: "2,4,6-Trichlorophenol (CAS 88-06-2)",
    wastewaterStandard: "0.035 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "7.4 mg/kg and meet § 268.48 standards",
  },
  {
    code: "D043",
    regulatedConstituent: "Vinyl chloride (CAS 75-01-4)",
    wastewaterStandard: "0.27 mg/L and meet § 268.48 standards",
    nonwastewaterStandard: "6.0 mg/kg and meet § 268.48 standards",
  },
];

/** All rows for a given D-code (may be more than one if it has subcategories). */
export function getTreatmentStandardsForCode(code: string): TreatmentStandardEntry[] {
  const normalized = code.trim().toUpperCase();
  return D_CODE_TREATMENT_STANDARDS.filter((entry) => entry.code === normalized);
}
