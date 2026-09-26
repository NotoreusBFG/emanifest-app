"use server";

import { createClient } from "@/lib/supabase/server";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { hasMinimumTier } from "@/services/entitlementRepository";
import { searchChemicalWasteCodesAction } from "@/app/actions/chemicalSearchActions";
import { extractStructuredFromText, AiGatewayNotConfiguredError } from "@/lib/ai/claudeClient";
import {
  WIZARD_CHEMICAL_TOOL_NAME,
  WIZARD_CHEMICAL_TOOL_SCHEMA,
  wizardTaskInstructions,
  type WizardExtractedChemical,
  type UnresolvedChemicalInput,
} from "@/lib/labPack/wizardSchema";
import { groupIntoDrums, type CharacterizedWizardItem, type DrumGroup } from "@/lib/labPack/packingRules";
import type { ParsedInventoryLine } from "@/lib/labPack/parseInventory";
import type { PhysicalState } from "@/lib/labPack/types";

/**
 * Gate for the Segregation Wizard -- feature flag AND 'pro' tier
 * (2026-09-26 entitlement scaffold, client directive: this is the
 * highest-tier wizard, the most AI-cost-intensive of the three).
 */
export async function isLabPackWizardEnabledForMeAction(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const [flagOn, tierOk] = await Promise.all([
    getFeatureFlag(supabase, "manifestmate_labpack_wizard_generator"),
    hasMinimumTier(supabase, user.id, "pro"),
  ]);
  return flagOn && tierOk;
}

export interface LocalFirstResult {
  resolved: CharacterizedWizardItem[];
  unresolved: ParsedInventoryLine[];
}

function hazardClassFromCodes(): string | undefined {
  // The local SRS/PubChem search (chemicalSearchActions.ts) returns waste
  // codes and an explanation, not a DOT hazard class -- hazard class for
  // locally-resolved items is left undefined here (the review screen lets
  // the human fill it in, same as today's manual ChemicalQuickAddModal
  // flow, which also doesn't auto-fill DOT class). Only the LLM fallback
  // path (which is explicitly asked for hazardClass) populates it directly.
  return undefined;
}

/**
 * Local-first pass: resolve every parsed line through the app's existing
 * SRS/PubChem search (no LLM cost) first. Only lines that come back with
 * zero codes AND no unconfirmed-listing hint are left for the LLM fallback
 * -- per the wizard handoff's cost-saving cascade, this keeps token spend
 * proportional to how many genuinely unrecognized names are in a given
 * paste, not the inventory size.
 */
export async function resolveLocallyAction(lines: ParsedInventoryLine[]): Promise<LocalFirstResult> {
  const resolved: CharacterizedWizardItem[] = [];
  const unresolved: ParsedInventoryLine[] = [];

  for (const line of lines) {
    const result = await searchChemicalWasteCodesAction(line.chemicalName);
    const best = result.success ? result.matches[0] : undefined;
    if (best && (best.codes.length > 0 || best.hasUnconfirmedListing)) {
      resolved.push({
        id: line.id,
        chemicalName: best.name || line.chemicalName,
        quantity: null,
        containerSize: line.containerSize,
        physicalState: null as PhysicalState | null,
        epaWasteCodes: best.codes,
        sourceLocation: "",
        notes: best.explanation ?? "",
        hazardClass: hazardClassFromCodes(),
      });
    } else {
      unresolved.push(line);
    }
  }

  return { resolved, unresolved };
}

export type ResolveWithAiState =
  | { success: true; resolved: CharacterizedWizardItem[] }
  | { success: false; error: string };

/**
 * LLM fallback pass -- one call per unresolved chemical (see
 * wizardSchema.ts's doc comment on why per-item rather than a batched
 * schema). Never throws for a single item's failure; a failed item comes
 * back as a NEEDS VERIFICATION placeholder so one bad lookup can't sink
 * the whole paste, matching the skill's own "never block" philosophy.
 */
export async function resolveWithAiAction(chemicals: UnresolvedChemicalInput[]): Promise<ResolveWithAiState> {
  const items: CharacterizedWizardItem[] = [];

  for (const chemical of chemicals) {
    try {
      const extracted = await extractStructuredFromText<WizardExtractedChemical>({
        taskInstructions: wizardTaskInstructions(chemical),
        toolName: WIZARD_CHEMICAL_TOOL_NAME,
        toolDescription: "Records one chemical's DOT/RCRA characterization, each field with a confidence level.",
        toolSchema: WIZARD_CHEMICAL_TOOL_SCHEMA,
      });

      const codes: string[] = [];
      if (extracted.fListCode.value.trim()) {
        const note = extracted.fListCode.confidence === "inferred" ? " (VERIFY -- AI-inferred, confirm before shipping)" : "";
        codes.push(`${extracted.fListCode.value.trim()}${note}`);
      }
      if (extracted.uListCode.value.trim() && !extracted.fListCode.value.trim()) {
        // Never both -- F-code (spent-by-default) wins unless there was no
        // F-code to begin with, mirroring packingRules.ts's own default.
        codes.push(extracted.uListCode.value.trim());
      } else if (extracted.uListCode.value.trim()) {
        codes.push(`VERIFY unused stock -- if so, ${extracted.uListCode.value.trim()} applies instead of ${extracted.fListCode.value.trim()}, not both`);
      }
      for (const d of extracted.dCodes.value) {
        if (d.trim()) codes.push(d.trim());
      }
      if (codes.length === 0) {
        codes.push("VERIFY -- AI characterization found no RCRA waste code for this item; confirm hazardous-waste status independently");
      }

      items.push({
        id: chemical.id,
        chemicalName: extracted.properShippingName.value || chemical.chemicalName,
        quantity: null,
        containerSize: "",
        physicalState: (extracted.physicalState.value || null) as PhysicalState | null,
        epaWasteCodes: codes,
        sourceLocation: "",
        notes: extracted.notes.value,
        hazardClass: extracted.hazardClass.value || undefined,
        unNumber: extracted.unNumber.value || undefined,
        isDotRegulated: Boolean(extracted.unNumber.value.trim()),
      });
    } catch (err) {
      if (err instanceof AiGatewayNotConfiguredError) {
        return { success: false, error: err.message };
      }
      items.push({
        id: chemical.id,
        chemicalName: chemical.chemicalName,
        quantity: null,
        containerSize: "",
        physicalState: null,
        epaWasteCodes: ["VERIFY -- AI characterization failed for this item; characterize manually before packing"],
        sourceLocation: "",
        notes: err instanceof Error ? err.message : "AI extraction failed.",
      });
    }
  }

  return { success: true, resolved: items };
}

export interface DrumGroupPreview extends DrumGroup {
  /** Composed once here so the review screen doesn't need to re-derive it
   * -- see packingRules.ts's shippingName(). Left as a plain descriptive
   * placeholder ("Hazardous Waste, Flammable Liquid, N.O.S. (...)") for
   * the human to refine into a real DOT shipping description on the
   * review screen; this wizard characterizes and groups, it does not
   * itself assign a final DOT proper shipping name across a whole drum. */
  suggestedContentsLabel: string;
}

/** Groups already-characterized items into drum previews for the review
 * screen. Thin wrapper around packingRules.ts's groupIntoDrums so the
 * server action boundary only needs one call. */
export async function groupIntoDrumsAction(items: CharacterizedWizardItem[]): Promise<DrumGroupPreview[]> {
  const drums = groupIntoDrums(items);
  return drums.map((d) => ({
    ...d,
    suggestedContentsLabel: d.items.map((i) => i.chemicalName).join(", "),
  }));
}
