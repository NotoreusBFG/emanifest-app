/**
 * Segregation Wizard extraction schema -- the LLM tool-call shape for
 * disambiguating chemicals the app's own local-first search
 * (chemicalSearchActions.ts's searchChemicalWasteCodesAction, which hits
 * EPA SRS + NLM PubChem, no LLM cost) couldn't resolve on its own. Mirrors
 * wizardExtraction.ts's WizardExtractedProfile pattern: every field is
 * required so the model always returns a judgment, with a confidence
 * flag rather than a silently-guessed value.
 *
 * Per the lab-pack-wizard-handoff.md local-first cascade: this is only
 * called for the LEFTOVER chemical names the local search returned zero
 * matches for, never the whole inventory -- keeps token cost proportional
 * to how many unrecognized names are in a given paste, not the inventory
 * size.
 */

export type WizardConfidence = "confident" | "inferred";
export interface WizardFieldFlag<V> {
  value: V;
  confidence: WizardConfidence;
}

export interface UnresolvedChemicalInput {
  /** The client-supplied id (matches the parsed inventory line so the
   * result can be merged back in) -- not sent to the model. */
  id: string;
  chemicalName: string;
  /** Free-text note carried from the pasted inventory line, e.g. "Reagent
   * grade" or "unused" -- passed through so the model can weigh the same
   * unused/virgin exception a human would. */
  rawLineText: string;
}

export interface WizardExtractedChemical {
  /** Best-guess DOT proper shipping name. */
  properShippingName: WizardFieldFlag<string>;
  unNumber: WizardFieldFlag<string>;
  /** e.g. "3", "6.1", "5.1", "8" -- division included where applicable. */
  hazardClass: WizardFieldFlag<string>;
  packingGroup: WizardFieldFlag<string>;
  /** RCRA F-list code (F002-F005 scope only, per client directive -- F001
   * is never assigned by default) if the chemical has one at all; empty
   * string if none applies. */
  fListCode: WizardFieldFlag<string>;
  /** RCRA U-list code, if the chemical is U-listed at all; empty string
   * if none applies. This is the code that would apply INSTEAD of
   * fListCode when isUnusedMaterial is true (or the model judges the item
   * meets the sole-active-ingredient/commercially-pure-grade exception on
   * its own -- flag that judgment via soleActiveIngredientLikely below). */
  uListCode: WizardFieldFlag<string>;
  /** Characteristic D-codes (D001-D043) -- independent of spent/unused
   * status, always evaluated on their own merits (flash point, pH, TCLP
   * metals, etc.). */
  dCodes: WizardFieldFlag<string[]>;
  physicalState: WizardFieldFlag<"liquid" | "solid" | "gas" | "">;
  /** True only if the model judges this chemical is commercially sold as
   * a single-active-ingredient pure/technical-grade product (the actual
   * 40 CFR 261.33 U-list eligibility test) -- distinct from the human
   * simply checking "unused material" for a general reagent bottle. */
  soleActiveIngredientLikely: WizardFieldFlag<boolean>;
  notes: WizardFieldFlag<string>;
}

const flag = (valueSchema: Record<string, unknown>) => ({
  type: "object",
  properties: {
    value: valueSchema,
    confidence: { type: "string", enum: ["confident", "inferred"] },
  },
  required: ["value", "confidence"],
});

const str = { type: "string" };
const bool = { type: "boolean" };
const strArray = { type: "array", items: { type: "string" } };

export const WIZARD_CHEMICAL_TOOL_NAME = "record_chemical_characterization";

export const WIZARD_CHEMICAL_TOOL_SCHEMA = {
  type: "object",
  properties: {
    properShippingName: flag(str),
    unNumber: flag(str),
    hazardClass: flag(str),
    packingGroup: flag(str),
    fListCode: flag(str),
    uListCode: flag(str),
    dCodes: flag(strArray),
    physicalState: flag({ type: "string", enum: ["liquid", "solid", "gas", ""] }),
    soleActiveIngredientLikely: flag(bool),
    notes: flag(str),
  },
  required: [
    "properShippingName",
    "unNumber",
    "hazardClass",
    "packingGroup",
    "fListCode",
    "uListCode",
    "dCodes",
    "physicalState",
    "soleActiveIngredientLikely",
    "notes",
  ],
};

/** One call per unresolved chemical -- the local-first cascade only ever
 * sends the small leftover set the app's own SRS/PubChem search couldn't
 * resolve, so per-chemical calls stay cheap and each schema/response pair
 * stays simple (WIZARD_CHEMICAL_TOOL_SCHEMA is a single flat
 * characterization object, not a keyed batch) rather than inventing a
 * dynamic multi-chemical schema for what's normally a handful of items. */
export function wizardTaskInstructions(chemical: UnresolvedChemicalInput): string {
  return `You are characterizing ONE chemical for a hazardous-waste lab pack that a local EPA/NLM database lookup could NOT resolve on its own: "${chemical.chemicalName}"${chemical.rawLineText ? ` (as listed on the client's inventory: "${chemical.rawLineText}")` : ""}.

Determine its DOT proper shipping name, UN number, hazard class, packing group, RCRA waste codes, and physical state.

Rules to follow exactly:
- Waste-code default: assume this item is SPENT/USED material. Only report a value for uListCode (instead of fListCode) if the chemical is the sole active ingredient / commercially pure grade of a U-listed product (40 CFR 261.33's actual eligibility test -- set soleActiveIngredientLikely true only in this case) OR the "as listed" text explicitly says virgin/new/unused. Otherwise report fListCode (F002-F005 scope only -- NEVER F001 by default, since F001 requires stated degreasing use) if the chemical has any F-list match at all, and leave uListCode empty.
- dCodes (D001-D043) are independent of spent/unused status -- report them on their own merits (flash point below 60C/140F -> D001, pH characteristics for AQUEOUS/LIQUID materials only -> D002 never for solids, TCLP toxicity thresholds -> D004-D043).
- If you cannot determine a field with real confidence, still provide your best value but set confidence to "inferred" rather than "confident" -- never leave a field blank, but never claim confidence you don't have either.
- Call the ${WIZARD_CHEMICAL_TOOL_NAME} tool exactly once with your complete characterization of this one chemical.`;
}
