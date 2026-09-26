/** One raw parsed line from the client's pasted inventory, before any
 * characterization -- chemical name + whatever quantity/unit text
 * followed it, kept verbatim for the review screen and for the LLM
 * fallback's "as listed" context (helps it catch an explicit
 * virgin/unused/new claim in the line itself). */
export interface ParsedInventoryLine {
  id: string;
  chemicalName: string;
  containerSize: string;
  rawLineText: string;
}

/**
 * Loose free-text inventory parser -- splits each non-empty line into a
 * chemical name and a trailing quantity/unit fragment (e.g. "Methanol 27L"
 * -> name "Methanol", size "27L"; "Iodine crystals x2" -> name "Iodine
 * crystals", size "x2"). Deliberately permissive: anything it can't cleanly
 * split just becomes the whole line as the chemical name with an empty
 * size, since the review screen lets the human fix any line before saving
 * -- this mirrors the skill's own "never guess a container count, ask the
 * packer to confirm" posture rather than trying to be a fully general
 * inventory-format parser.
 *
 * Pure/sync -- kept out of labPackWizardActions.ts (a "use server" module,
 * where every export must be an async Server Action) and runs client-side
 * directly, no round trip needed for plain string splitting.
 */
export function parseInventoryText(text: string): ParsedInventoryLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const TRAILING_QTY_RE = /^(.*?)[\s,]+((?:x\s*\d+)|(?:\d+(?:\.\d+)?\s*(?:kg|g|gr|mg|l|ml|lb|lbs|oz|gal|gallons?|pt|pints?|qt|quarts?)\b.*))$/i;

  return lines.map((line, i) => {
    const m = TRAILING_QTY_RE.exec(line);
    if (m) {
      return { id: `L${i + 1}`, chemicalName: m[1].trim(), containerSize: m[2].trim(), rawLineText: line };
    }
    return { id: `L${i + 1}`, chemicalName: line, containerSize: "", rawLineText: line };
  });
}
