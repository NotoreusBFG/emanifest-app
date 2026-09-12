import { extractStructuredFromPdf } from "@/lib/ai/claudeClient";
import type {
  WasteCategory,
  WastewaterCategory,
  PhysicalState,
  WasteProfileInput,
} from "@/services/wasteProfileRepository";

export type WizardConfidence = "confident" | "inferred";
export interface WizardFieldFlag<V> {
  value: V;
  confidence: WizardConfidence;
}

/**
 * Everything the ManifestMate Wizard can plausibly get from a
 * facility-issued waste profile document -- deliberately excludes
 * generator identity and profile naming (see wasteProfileRepository's
 * WasteProfileInput for the full field list): those are fixed before
 * upload / entered by the human, never document-derived. See
 * project_manifestmate_wizard_ai_scoping memory for why SDS input is out
 * of scope entirely -- this only ever runs against a document that
 * already represents an approved waste stream.
 */
export interface WizardExtractedProfile {
  wasteCategory: WizardFieldFlag<WasteCategory>;
  dotHazardous: WizardFieldFlag<boolean>;
  isRcraWaste: WizardFieldFlag<boolean>;
  properShippingName: WizardFieldFlag<string>;
  hazardClass: WizardFieldFlag<string>;
  packingGroup: WizardFieldFlag<string>;
  idNumberCode: WizardFieldFlag<string>;
  federalWasteCode: WizardFieldFlag<string>;
  rqIndicator: WizardFieldFlag<boolean>;
  wastewaterCategory: WizardFieldFlag<WastewaterCategory>;
  isLabPack: WizardFieldFlag<boolean>;
  wasteDescription: WizardFieldFlag<string>;
  disposalFacilityName: WizardFieldFlag<string>;
  disposalFacilityEpaId: WizardFieldFlag<string>;
  disposalFacilityProfileNumber: WizardFieldFlag<string>;
  physicalState: WizardFieldFlag<PhysicalState | "">;
  isIgnitable: WizardFieldFlag<boolean>;
  isCorrosive: WizardFieldFlag<boolean>;
  isReactive: WizardFieldFlag<boolean>;
  isToxic: WizardFieldFlag<boolean>;
  specificGravity: WizardFieldFlag<number | null>;
}

const TOOL_NAME = "record_waste_profile_extraction";

// A "flag" sub-schema, reused for every field: {value, confidence}. Every
// field is required so Claude always returns a judgment either way -- an
// empty value with a confidence, never an omitted key -- matching the
// scoping doc's "leave blank with a reason rather than guess" rule.
function flag(valueSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      value: valueSchema,
      confidence: { type: "string", enum: ["confident", "inferred"] },
    },
    required: ["value", "confidence"],
  };
}

const str = { type: "string" };
const bool = { type: "boolean" };
const numOrNull = { type: ["number", "null"] };

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    wasteCategory: flag({ type: "string", enum: ["hazardous", "non_hazardous", "universal"] }),
    dotHazardous: flag(bool),
    isRcraWaste: flag(bool),
    properShippingName: flag(str),
    hazardClass: flag(str),
    packingGroup: flag(str),
    idNumberCode: flag(str),
    federalWasteCode: flag(str),
    rqIndicator: flag(bool),
    wastewaterCategory: flag({ type: "string", enum: ["wastewater", "nonwastewater"] }),
    isLabPack: flag(bool),
    wasteDescription: flag(str),
    disposalFacilityName: flag(str),
    disposalFacilityEpaId: flag(str),
    disposalFacilityProfileNumber: flag(str),
    physicalState: flag({ type: "string", enum: ["solid", "liquid", "sludge", "gas", ""] }),
    isIgnitable: flag(bool),
    isCorrosive: flag(bool),
    isReactive: flag(bool),
    isToxic: flag(bool),
    specificGravity: flag(numOrNull),
  },
  required: [
    "wasteCategory",
    "dotHazardous",
    "isRcraWaste",
    "properShippingName",
    "hazardClass",
    "packingGroup",
    "idNumberCode",
    "federalWasteCode",
    "rqIndicator",
    "wastewaterCategory",
    "isLabPack",
    "wasteDescription",
    "disposalFacilityName",
    "disposalFacilityEpaId",
    "disposalFacilityProfileNumber",
    "physicalState",
    "isIgnitable",
    "isCorrosive",
    "isReactive",
    "isToxic",
    "specificGravity",
  ],
};

const TASK_INSTRUCTIONS = `This PDF is a facility-issued waste profile document -- an acceptance or characterization form a disposal facility has already approved for a waste stream. It is NOT a plain safety data sheet (SDS); do not treat it as one, and do not attempt to characterize or approve anything yourself. Your job is only to read what the document already states and organize it into ManifestMate's waste-profile fields.

For every field: if the document states it directly (a labeled field, a checked box, explicit text), set confidence to "confident". If you have to infer it from other stated facts (e.g. a federal waste code inferred from ignitability data in a properties section, rather than a code explicitly cited), set confidence to "inferred". If the document genuinely doesn't address a field at all, leave its value empty ("", false, or null as appropriate for that field's type) and mark it "inferred" rather than guessing.

A waste profile document usually states the disposal facility's name, EPA ID, and its own profile/approval number directly -- that is normally the whole point of the document, so treat those as expected fields, not rare ones.

If dotHazardous is false, wasteDescription is the primary field to fill (a plain description of the waste); the DOT-specific fields (properShippingName, hazardClass, packingGroup, idNumberCode, federalWasteCode) can be left empty in that case.

Call the ${TOOL_NAME} tool with your complete extraction.`;

export async function extractWasteProfileFromPdf(pdfBase64: string): Promise<WizardExtractedProfile> {
  return extractStructuredFromPdf<WizardExtractedProfile>({
    pdfBase64,
    taskInstructions: TASK_INSTRUCTIONS,
    toolName: TOOL_NAME,
    toolDescription: "Records the fields extracted from a waste profile document, each with a confidence level.",
    toolSchema: TOOL_SCHEMA,
  });
}

/** Splits a WizardExtractedProfile into the two props WasteProfileFormFields
 * needs in wizard mode: plain pre-fill values, and a parallel confidence
 * map for the ✓ Wizard / ⚑ Check this badges. */
export function toFormFieldsProps(extracted: WizardExtractedProfile): {
  initialValues: Partial<WasteProfileInput>;
  wizardFlags: Partial<Record<keyof WasteProfileInput, WizardConfidence>>;
} {
  const initialValues: Partial<WasteProfileInput> = {};
  const wizardFlags: Partial<Record<keyof WasteProfileInput, WizardConfidence>> = {};
  for (const key of Object.keys(extracted) as (keyof WizardExtractedProfile)[]) {
    const { value, confidence } = extracted[key];
    // physicalState's "" placeholder (no radio option matches an empty
    // string) maps to null, matching WasteProfileInput's own null-when-unset convention.
    (initialValues as Record<string, unknown>)[key] = key === "physicalState" && value === "" ? null : value;
    wizardFlags[key as keyof WasteProfileInput] = confidence;
  }
  return { initialValues, wizardFlags };
}
