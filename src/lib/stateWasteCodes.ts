/**
 * State-specific hazardous waste codes -- supplemental to (never replacing)
 * the federal RCRA D/F/K/P/U codes in `wasteCodeReference.ts`. Compiled from
 * a curated research pass (state agency PDFs, NEWMOA's Northeast States
 * Hazardous Waste Codes survey), NOT a live feed from any agency API.
 *
 * CONFIRMED against EPA's real e-Manifest schema (`emanifest.json`,
 * USEPA/e-manifest repo, `hazardousWaste` object) that these have a real
 * home in a FullElectronic submission -- three dedicated fields exist
 * alongside `federalWasteCodes`:
 *   - `generatorStateWasteCodes` -- CodeDescription[] (code, optional description)
 *   - `tsdfStateWasteCodes` -- CodeDescription[], same shape, for the
 *     designated facility's state instead of the generator's
 *   - `txWasteCodes` -- string[], each exactly 8 characters (matches the
 *     generator-assigned TX Waste Code formula below exactly)
 * None of these three fields are modeled in `rcrainfo/types.ts` yet, and
 * nothing in the manifest creation form captures a state waste code today
 * -- this file is reference data only, not yet wired into what actually
 * gets submitted. See NEXT_SESSION notes for that follow-up.
 *
 * `states_confirmed_no_supplemental_codes` distinguishes "confirmed this
 * state has none" from "not yet researched" -- absence from this file's
 * `STATE_WASTE_CODES` map is NOT proof a state has no supplemental codes,
 * only that this pass didn't cover it.
 */

export type StateWasteCodeConfidence = "confirmed" | "confirmed_absence";

export interface StateWasteCodeEntry {
  code: string;
  description: string;
}

export interface StateWasteCodeCategory {
  note?: string;
  codes: StateWasteCodeEntry[];
}

export interface StateWasteCodeState {
  stateName: string;
  agency: string;
  regulatoryCitation?: string;
  sourceDocument?: string;
  sourceUrl?: string;
  relationshipToRcra: string;
  codeSystemType:
    | "enumerated_substance_codes"
    | "enumerated_substance_codes_non_hazardous"
    | "enumerated_criteria_codes"
    | "generator_assigned_formula"
    | "mixed"
    | "none";
  confidence: StateWasteCodeConfidence;
  /** Flat code list, for states with one simple list. */
  codes?: StateWasteCodeEntry[];
  /** Grouped code list, for states organized into categories (e.g. CA). */
  codeCategories?: Record<string, StateWasteCodeCategory>;
  /** Notes on additional detail worth surfacing (not full sub-schemas). */
  notes?: string[];
}

export const STATE_WASTE_CODES_META = {
  compiled: "2026-07-27",
  schemaVersion: "1.0",
  statesConfirmedNoSupplementalCodes: ["NJ", "PA"] as const,
  importantCaveats: [
    "This is a compliance-adjacent reference, not legal advice -- always confirm against the current version of the cited regulation/agency guidance before relying on this in production, since these lists are periodically amended.",
    "Some states (TX, NY, WA) use codes that describe HOW a waste qualifies or will be managed, not what specific chemical it is -- structurally different from RCRA's substance-based codes and from CA's/MA's/RI's enumerated waste-type lists.",
    "TX's Texas Waste Code is generator-specific, including a 4-digit sequence number the generator itself assigns -- treat it as a formula, not an enumerable code list.",
    "A state's absence from STATE_WASTE_CODES below means 'not yet researched', NOT 'confirmed no supplemental codes' -- only NJ and PA carry that confirmation so far.",
  ],
};

export const STATE_WASTE_CODES: Record<string, StateWasteCodeState> = {
  CA: {
    stateName: "California",
    agency: "Department of Toxic Substances Control (DTSC)",
    regulatoryCitation: "Title 22 CCR, Appendix XII to Chapter 12 of Division 4.5",
    sourceDocument: "Supplemental California Manifest Instructions (DTSC, rev. 11/15/2017)",
    sourceUrl:
      "https://dtsc.ca.gov/wp-content/uploads/sites/31/2019/06/Supplemental-California-Manifest-Instructions_11-17.pdf",
    relationshipToRcra:
      "CA requires at least one RCRA code (if federally regulated) PLUS at least one CA state waste code on the manifest for waste generated in or shipped to California. CA also regulates some wastes as hazardous that are not RCRA hazardous federally (broader TTLC/STLC thresholds).",
    codeSystemType: "enumerated_substance_codes",
    confidence: "confirmed",
    codeCategories: {
      restricted_wastes: {
        note: "Use these first, if applicable, per DTSC instructions",
        codes: [
          { code: "711", description: "Liquids with cyanides > 1000 mg/l" },
          { code: "721", description: "Liquids with arsenic > 500 mg/l" },
          { code: "722", description: "Liquids with cadmium > 100 mg/l" },
          { code: "723", description: "Liquids with chromium (VI) > 500 mg/l" },
          { code: "724", description: "Liquids with lead > 500 mg/l" },
          { code: "725", description: "Liquids with mercury > 20 mg/l" },
          { code: "726", description: "Liquids with nickel > 134 mg/l" },
          { code: "727", description: "Liquids with selenium > 100 mg/l" },
          { code: "728", description: "Liquids with thallium > 130 mg/l" },
          { code: "731", description: "Liquids with polychlorinated biphenyls > 50 mg/l" },
          { code: "741", description: "Liquids with halogenated organic compounds > 1000 mg/l" },
          { code: "751", description: "Solids or sludges with halogenated organic compounds > 1000 mg/kg" },
          { code: "791", description: "Liquids with pH < 2" },
          { code: "792", description: "Liquids with pH < 2 with metals" },
          { code: "801", description: "Waste potentially containing dioxins" },
        ],
      },
      inorganics: {
        codes: [
          { code: "121", description: "Alkaline solution (pH < 12.5) with metals (antimony, arsenic, barium, beryllium, cadmium, chromium, cobalt, copper, lead, mercury, molybdenum, nickel, selenium, silver, thallium, vanadium, zinc)" },
          { code: "122", description: "Alkaline solution without metals (pH > 12.5)" },
          { code: "123", description: "Unspecified alkaline solution" },
          { code: "131", description: "Aqueous solution (2 < pH < 12.5) containing reactive anions (azide, bromate, chlorate, cyanide, fluoride, hypochlorite, nitrite, perchlorate, sulfide)" },
          { code: "132", description: "Aqueous solution w/ metals (restricted levels -- see code 121 for metals list)" },
          { code: "133", description: "Aqueous solution with 10% or more total organic residues" },
          { code: "134", description: "Aqueous solution with <10% total organic residues" },
          { code: "135", description: "Unspecified aqueous solution" },
          { code: "141", description: "Off-specification, aged, or surplus inorganics" },
          { code: "151", description: "Asbestos-containing waste" },
          { code: "161", description: "Fluid-cracking catalyst (FCC) waste" },
          { code: "162", description: "Other spent catalyst" },
          { code: "171", description: "Metal sludge (see 121)" },
          { code: "172", description: "Metal dust (see 121) and machining waste" },
          { code: "181", description: "Other inorganic solid waste" },
        ],
      },
      organics: {
        codes: [
          { code: "211", description: "Halogenated solvents (chloroform, methyl chloride, perchloroethylene, etc.)" },
          { code: "212", description: "Oxygenated solvents (acetone, butanol, ethyl acetate, etc.)" },
          { code: "213", description: "Hydrocarbon solvents (benzene, hexane, Stoddard, etc.)" },
          { code: "214", description: "Unspecified solvent mixture" },
          { code: "221", description: "Waste oil and mixed oil" },
          { code: "222", description: "Oil/water separation sludge" },
          { code: "223", description: "Unspecified oil-containing waste" },
          { code: "231", description: "Pesticide rinse water" },
          { code: "232", description: "Pesticides and other waste associated with pesticide production" },
          { code: "241", description: "Tank bottom waste" },
          { code: "251", description: "Still bottoms with halogenated organics" },
          { code: "252", description: "Other still bottom waste" },
          { code: "261", description: "Polychlorinated biphenyls and material containing PCBs" },
          { code: "271", description: "Organic monomer waste (includes unreacted resins)" },
          { code: "272", description: "Polymeric resin waste" },
          { code: "281", description: "Adhesives" },
          { code: "291", description: "Latex waste" },
          { code: "311", description: "Pharmaceutical waste" },
          { code: "321", description: "Sewage sludge" },
          { code: "322", description: "Biological waste other than sewage sludge" },
          { code: "331", description: "Off-specification, aged, or surplus organics" },
          { code: "341", description: "Organic liquids (nonsolvents) with halogens" },
          { code: "342", description: "Organic liquids with metals (see 121)" },
          { code: "343", description: "Unspecified organic liquid mixture" },
          { code: "351", description: "Organic solids with halogens" },
          { code: "352", description: "Other organic solids" },
        ],
      },
      sludges: {
        codes: [
          { code: "411", description: "Alum and gypsum sludge" },
          { code: "421", description: "Lime sludge" },
          { code: "431", description: "Phosphate sludge" },
          { code: "441", description: "Sulfur sludge" },
          { code: "451", description: "Degreasing sludge" },
          { code: "461", description: "Paint sludge" },
          { code: "471", description: "Paper sludge/pulp" },
          { code: "481", description: "Tetraethyl lead sludge" },
          { code: "491", description: "Unspecified sludge waste" },
        ],
      },
      miscellaneous: {
        codes: [
          { code: "511", description: "Empty pesticide containers 30 gallons or more" },
          { code: "512", description: "Other empty containers 30 gallons or more" },
          { code: "513", description: "Empty containers less than 30 gallons" },
          { code: "521", description: "Drilling mud" },
          { code: "531", description: "Chemical toilet waste" },
          { code: "541", description: "Photochemicals / photoprocessing waste" },
          { code: "551", description: "Laboratory waste chemicals" },
          { code: "561", description: "Detergent and soap" },
          { code: "571", description: "Fly ash, bottom ash, and retort ash" },
          { code: "581", description: "Gas scrubber waste" },
          { code: "591", description: "Baghouse waste" },
          { code: "611", description: "Contaminated soil from site clean-ups" },
          { code: "612", description: "Household waste" },
          { code: "613", description: "Auto shredder waste" },
          { code: "614", description: "Treated wood waste" },
        ],
      },
    },
    notes: [
      "Related but separate system: Hazardous Waste Report Management Method (HWRMM) codes are added by destination facilities only, describing how waste was handled -- not modeled here since generators/transporters never enter them.",
    ],
  },

  TX: {
    stateName: "Texas",
    agency: "Texas Commission on Environmental Quality (TCEQ)",
    regulatoryCitation: "30 Texas Administrative Code (TAC) Chapter 335, Subchapter R (§335.501-.521)",
    sourceDocument: "RG-022: Guidelines for the Classification and Coding of Industrial and Hazardous Wastes",
    sourceUrl: "https://www.tceq.texas.gov/permitting/registration/ihw/epa_waste_manifest_system.html",
    relationshipToRcra:
      "TX requires the Texas Waste Code entered alongside applicable RCRA codes (D/F/K/P/U), not instead of them. It's an 8-character code the generator itself assigns per registered waste stream (4-digit sequence number + 3-digit TCEQ form code + 1-digit classification code: H/1/2/3), not a fixed universal lookup table.",
    codeSystemType: "generator_assigned_formula",
    confidence: "confirmed",
    notes: [
      "Worked example: sequence 5555 + form code 001 + classification H -> 5555001H.",
      "Known fixed special-case codes: PHRM005H (non-creditable hazardous waste pharmaceuticals, 30 TAC §335.755(c)); RRCT- prefix (Railroad Commission of Texas-regulated oil & gas facilities).",
      "Open question: the full 3-digit TCEQ form code list (from RG-022) isn't transcribed yet -- needed to actually construct a code programmatically. Sequence numbers are generator-specific, registered via TCEQ's own Notice of Registration process.",
    ],
  },

  MA: {
    stateName: "Massachusetts",
    agency: "Massachusetts Department of Environmental Protection (MassDEP)",
    regulatoryCitation: "310 CMR 30.144 (state-designated hazardous waste) and related sections of 310 CMR 30.000",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra:
      "MA-prefixed codes are entered on the manifest alongside RCRA codes. Some (MA00, MA04) carry recordkeeping/manifesting requirements without contributing to federal generator status; others (MA95, MA97-99) describe how non-hazardous or recyclable material is being shipped on a hazardous waste manifest.",
    codeSystemType: "enumerated_substance_codes",
    confidence: "confirmed",
    codes: [
      { code: "MA00", description: "Hazardous waste as specifically designated by MassDEP under 310 CMR 30.144 -- must include the most hazardous constituent, the designation date, and the designating office." },
      { code: "MA01", description: "Waste oil" },
      { code: "MA02", description: "PCB waste > 50 ppm" },
      { code: "MA04", description: "Waste paint from paint manufacturers not otherwise characteristic/listed hazardous, but formulated with MA-listed hazardous ingredients (310 CMR 30.160) or ≥1% state-defined hazardous constituents by weight" },
      { code: "MA95", description: "Universal waste shipped on a hazardous waste manifest by a licensed hazardous waste transporter" },
      { code: "MA97", description: "Class A regulated recyclable material (including specification used oil fuel) shipped on a hazardous waste manifest" },
      { code: "MA98", description: "Off-specification used oil fuel shipped using a hazardous waste manifest" },
      { code: "MA99", description: "Not hazardous waste -- used for non-hazardous material shipped on a hazardous waste manifest" },
    ],
  },

  NY: {
    stateName: "New York",
    agency: "New York State Department of Environmental Conservation (NYSDEC)",
    regulatoryCitation: "6 NYCRR Part 371.4(e) (PCB waste listing); 6 NYCRR Part 372.2(b)(2)(ii) (disposal-method codes)",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021); 6 NYCRR Part 371/372",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra:
      "Two distinct NY-specific systems. (1) A PCB waste listing (B001-B007), broader than the federal PCB threshold treatment in some respects. (2) A disposal-method code required in Item 13 ONLY when the receiving facility doesn't already report an ultimate-disposal management code in Item 19 -- describes the waste's fate, not its identity.",
    codeSystemType: "mixed",
    confidence: "confirmed",
    codes: [
      { code: "B001", description: "PCB oil (concentrated) from transformers, capacitors, etc." },
      { code: "B002", description: "Petroleum oil or other liquid containing 50-<500 ppm PCBs, including oil from electrical equipment of unknown PCB concentration (except circuit breakers, reclosers, rectifiers, cable)" },
      { code: "B003", description: "Petroleum oil or other liquid containing ≥500 ppm PCBs" },
      { code: "B004", description: "PCB articles containing 50-<500 ppm PCBs (excluding small capacitors), including oil-filled electrical equipment of unknown PCB concentration (except circuit breakers, reclosers, rectifiers, cable)" },
      { code: "B005", description: "PCB articles other than transformers containing ≥500 ppm PCBs, excluding small capacitors" },
      { code: "B006", description: "PCB transformers -- any transformer containing ≥500 ppm PCB" },
      { code: "B007", description: "Other PCB wastes, including contaminated soil, solids, sludges, clothing, rags, dredge material" },
      { code: "L", description: "Disposal-method code: Landfill (Item 13, only if Item 19 code absent)" },
      { code: "B (disposal)", description: "Disposal-method code: Incineration, heat recovery, burning (Item 13, only if Item 19 code absent)" },
      { code: "T", description: "Disposal-method code: Chemical, physical, or biological treatment (Item 13, only if Item 19 code absent)" },
      { code: "R", description: "Disposal-method code: Material recovery of more than 75% of the total material (Item 13, only if Item 19 code absent)" },
    ],
  },

  WA: {
    stateName: "Washington",
    agency: "Washington State Department of Ecology",
    regulatoryCitation: "WAC 173-303-100 (state-specific dangerous waste numbers / criteria)",
    sourceDocument: "Washington Dept. of Ecology guidance (Designation -- State-only criteria)",
    sourceUrl:
      "https://ecology.wa.gov/regulations-permits/guidance-technical-assistance/dangerous-waste-guidance/dangerous-waste-basics/designation/check-washington-state-only-criteria",
    relationshipToRcra:
      "WA calls its program \"Dangerous Waste.\" These state-only codes designate waste as dangerous based on WA-specific toxicity, persistence, or corrosivity criteria broader than federal RCRA characteristics -- a waste can be a WA dangerous waste without carrying any federal RCRA code at all.",
    codeSystemType: "enumerated_criteria_codes",
    confidence: "confirmed",
    codes: [
      { code: "WT01", description: "State toxic -- extremely hazardous waste (EHW). Equivalent concentration (EC) ≥ 1%. Counts toward the 2.2 lb quantity exclusion limit as an EHW." },
      { code: "WT02", description: "State toxic -- dangerous waste (DW), lower severity than WT01. EC ≥ 0.001% and < 1%." },
      { code: "WP01", description: "Persistent -- halogenated organic compounds (HOCs) > 1.0% by weight; designates as EHW." },
      { code: "WP02", description: "Persistent -- HOCs 0.01%-1.0% by weight; designates as DW." },
      { code: "WP03", description: "Persistent -- polycyclic aromatic hydrocarbons (PAHs) > 1.0% concentration; designates as EHW." },
      { code: "WPCB", description: "Persistent -- PCB-containing waste (state-only persistent category, distinct from federal PCB/TSCA regulation)." },
      { code: "WSC2", description: "Solid corrosive -- solid/semi-solid waste that, mixed 50/50 with deionized water, exhibits pH ≤ 2 or ≥ 12.5." },
    ],
    notes: [
      "WP01, WP03, and WT01 are the only WA state-only codes that designate Extremely Hazardous Waste (EHW); all others here are standard Dangerous Waste (DW).",
      "WT01 vs. WT02 uses a published Toxic Category Table (X/A/B/C/D) and an equivalent-concentration formula, not a simple threshold lookup.",
    ],
  },

  PA: {
    stateName: "Pennsylvania",
    agency: "Pennsylvania Department of Environmental Protection (PADEP)",
    regulatoryCitation: "25 Pa. Code Chapters 260a-266a",
    sourceDocument: "PA DEP Hazardous Waste FAQ and PA Manifest Requirements pages",
    sourceUrl:
      "https://www.pa.gov/agencies/dep/programs-and-services/waste-programs/solid-waste-programs/hazardous-waste-program/hazardous-waste-transportation/pa-manifest-requirements",
    relationshipToRcra:
      "Pennsylvania incorporates federal RCRA hazardous waste regulations by reference (25 Pa. Code §260a.3(e)) without adding a supplemental hazardous-waste code system for the manifest. RCRA codes alone are used.",
    codeSystemType: "none",
    confidence: "confirmed_absence",
    codes: [],
    notes: [
      "PA's separate Residual Waste Program regulates NON-hazardous industrial waste under its own numeric code system (form 2540-PM-BWM0404) for state biennial reporting -- not used on the RCRA hazardous waste manifest, not modeled here.",
    ],
  },

  CT: {
    stateName: "Connecticut",
    agency: "Connecticut Department of Energy and Environmental Protection (CT DEEP)",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra:
      "These CR-prefixed codes apply ONLY to non-RCRA-hazardous wastes in Connecticut -- per NEWMOA's own note, they are explicitly NOT state hazardous waste codes in the RCRA sense. Wastes bearing these codes must still be shipped by CT-permitted transporters (except CR05), and CT-based TSD facilities handling them need a state operating permit.",
    codeSystemType: "enumerated_substance_codes_non_hazardous",
    confidence: "confirmed",
    codes: [
      { code: "CR01", description: "Waste PCBs with concentrations ≥ 50 ppm" },
      { code: "CR02", description: "Waste oil" },
      { code: "CR03", description: "Wastewater soluble oil" },
      { code: "CR04", description: "Waste chemical liquids that are toxic, hazardous to handle, and/or may cause contamination of ground and/or surface water" },
      { code: "CR05", description: "Waste chemical solids and semi-solids" },
    ],
  },

  ME: {
    stateName: "Maine",
    agency: "Maine Department of Environmental Protection",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra:
      "M002 is a fixed additional code. Maine also maintains its own state-only K-, P-, and U-prefixed series for process-specific and chemical-specific wastes not federally listed -- these mirror RCRA's lettering scheme but are a distinct, Maine-only set of numbers, not extensions of the federal lists.",
    codeSystemType: "mixed",
    confidence: "confirmed",
    codes: [{ code: "M002", description: "PCB toxic waste" }],
    notes: [
      "Additional state-only K###/P###/U### series exist for process- and chemical-specific wastes not federally listed. NEWMOA's source says to contact Maine DEP directly for the full numeric list -- not available from this source.",
    ],
  },

  NH: {
    stateName: "New Hampshire",
    agency: "New Hampshire Department of Environmental Services",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra: "Supplemental codes used alongside RCRA codes where applicable.",
    codeSystemType: "enumerated_substance_codes",
    confidence: "confirmed",
    codes: [
      { code: "NHX1", description: "Exempt, recycled hazardous waste" },
      { code: "NH01", description: "Used oil" },
      { code: "NH02", description: "Corrosive solid" },
    ],
  },

  NJ: {
    stateName: "New Jersey",
    agency: "New Jersey Department of Environmental Protection (NJDEP)",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra: "New Jersey uses federal RCRA codes only -- no supplemental state waste codes, per NEWMOA's regional survey.",
    codeSystemType: "none",
    confidence: "confirmed_absence",
    codes: [],
  },

  RI: {
    stateName: "Rhode Island",
    agency: "Rhode Island Department of Environmental Management (RI DEM)",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra: "Supplemental codes used alongside RCRA codes where applicable.",
    codeSystemType: "enumerated_substance_codes",
    confidence: "confirmed",
    codes: [
      { code: "R001", description: "Electronics" },
      { code: "R006", description: "Extremely hazardous waste" },
      { code: "R007", description: "PCB waste > 50 ppm" },
      { code: "R009", description: "Mercury containing waste" },
      { code: "R010", description: "Waste used oil" },
      { code: "R011", description: "Secondary waste generated by a hazardous waste management facility as a result of treatment" },
      { code: "R012", description: "Precious metal bearing waste" },
      { code: "R013", description: "Household hazardous waste" },
      { code: "R014", description: "Waste used oil shipped to a state that regulates it" },
      { code: "R015", description: "Waste not meeting the definition of hazardous waste that is required to be on a manifest by the destination state" },
      { code: "R016", description: "Removal action waste generated by RI DEM / US EPA if the governing body is not the responsible party" },
    ],
  },

  VT: {
    stateName: "Vermont",
    agency: "Vermont Department of Environmental Conservation",
    regulatoryCitation: "Vermont Hazardous Waste Management Regulations, e.g. §7-206(a)(3), §7-213, §7-216",
    sourceDocument: "Northeast States Hazardous Waste Codes (NEWMOA, 4/29/2021)",
    sourceUrl: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf",
    relationshipToRcra: "Supplemental codes used alongside RCRA codes where applicable. VT99 marks non-hazardous, tax-exempt materials shipped on a manifest.",
    codeSystemType: "enumerated_substance_codes",
    confidence: "confirmed",
    codes: [
      { code: "VT01", description: "Wastes containing PCBs in concentrations > 50 parts per million" },
      { code: "VT02", description: "Waste containing > 5% by weight of petroleum distillates with melting points < 100°F (e.g., fuel oil, hydraulic oils, automotive oils)" },
      { code: "VT03", description: "Wastewater-miscible metal cutting & grinding fluid" },
      { code: "VT06", description: "Pesticidal wastes & obsolete pesticidal products not specifically listed elsewhere and regulated by the VT Dept. of Agriculture; excludes certain products such as citronella candles" },
      { code: "VT08", description: "Waste ethylene glycol & solutions containing > 700 ppm ethylene glycol (e.g., coolants, antifreeze)" },
      { code: "VT11", description: "Wastes determined to be hazardous pursuant to §7-213 or §7-216" },
      { code: "VT20", description: "Solid material that, when mixed with an equal weight of distilled water, causes the liquid fraction to exhibit corrosivity characteristics per §7-206(a)(3)" },
      { code: "VT99", description: "Non-hazardous waste; tax-exempt materials on manifests" },
    ],
    notes: [
      "Source PDF references codes for PFOA & PFOS > 20 ppt immediately after VT99, but the text was truncated in the fetched version -- a specific VT code number for PFAS wastes wasn't captured; confirm directly against current VT DEC guidance.",
    ],
  },
};

/** True only for states CONFIRMED to add real supplemental codes -- excludes confirmed_absence states (PA, NJ) and states not yet researched. */
export function hasSupplementalStateWasteCodes(stateAbbr: string | null | undefined): boolean {
  if (!stateAbbr) return false;
  const entry = STATE_WASTE_CODES[stateAbbr.toUpperCase()];
  return !!entry && entry.confidence === "confirmed";
}

export function getStateWasteCodeEntry(stateAbbr: string | null | undefined): StateWasteCodeState | undefined {
  if (!stateAbbr) return undefined;
  return STATE_WASTE_CODES[stateAbbr.toUpperCase()];
}
