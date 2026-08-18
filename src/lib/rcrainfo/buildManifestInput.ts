import { AGENCY_AUTHORITY_ITEM_14_TEXT } from "@/lib/rcrainfo/certificationText";
import type { NewManifestInput, WasteLine } from "@/lib/rcrainfo/types";

export interface WasteLineMetadataInput {
  lineNumber: number;
  wastewaterCategory: "wastewater" | "nonwastewater";
  isLabPack: boolean;
}

export interface BuildWasteLinesResult {
  wastes: WasteLine[];
  wasteLineMetadata: WasteLineMetadataInput[];
  /** Per-line "Line N: ..." notes, unjoined — callers combine these
   * differently depending on context (a full create composes them
   * alongside the base handlingInstructions text and any agency-authority
   * certification, see buildNewManifestInputFromFormData below; a
   * waste-line-only update appends them onto a manifest's EXISTING live
   * handlingInstructions instead, see wasteLineEditActions.ts). */
  lineInstructionNotes: string[];
  /** Set when validation failed — callers should return this to the user
   * instead of proceeding to save/persist anything. */
  error?: string;
}

/**
 * Parses the wasteLineIds/`{field}_{id}` FormData convention
 * ManifestFieldsForm's waste-line fieldset emits, shared by the owner's
 * full manifest create (buildNewManifestInputFromFormData below) and the
 * waste-line-only delegate edit flow (wasteLineEditActions.ts) — both
 * build the exact same WasteLine[] shape from the exact same field names,
 * instead of two copies that could drift apart. Mechanically unchanged
 * from when this lived inline in createManifestAction — same validation
 * messages, same DOT-string field order (49 CFR 172.202(b)).
 */
export function buildWasteLinesFromFormData(formData: FormData): BuildWasteLinesResult {
  const wasteLineIds = (formData.get("wasteLineIds") as string).split(",").filter(Boolean);
  const wastes: WasteLine[] = [];
  const lineErrors: string[] = [];
  const lineInstructionNotes: string[] = [];
  // Wastewater/nonwastewater per line -- a ManifestMate-only concept
  // (RCRAInfo's schema has no field for it), captured here so it's known
  // and accurate later if an LDR notice gets filed for this manifest,
  // instead of guessing. Keyed by the same displayLineNumber sent to EPA,
  // so it matches back up against manifest.wastes[].lineNumber on a
  // subsequent GET.
  const wasteLineMetadata: WasteLineMetadataInput[] = [];

  for (const id of wasteLineIds) {
    const w = (name: string) => (formData.get(`${name}_${id}`) as string)?.trim() ?? "";
    const isHazardous = formData.get(`dotHazardous_${id}`) === "on";
    const properShippingName = w("properShippingName");
    const wasteDescription = w("wasteDescription");
    const description = isHazardous ? properShippingName : wasteDescription;
    if (!description) continue; // unused slot

    const displayLineNumber = wastes.length + 1;
    const specialInstructions = w("specialInstructions");
    if (specialInstructions) {
      lineInstructionNotes.push(`Line ${displayLineNumber}: ${specialInstructions}`);
    }

    const quantity = Number(w("quantity"));
    const unitCode = w("unitCode").toUpperCase();
    const containerNumber = Number(w("containerNumber"));
    const containerTypeCode = w("containerTypeCode").toUpperCase();
    if (!quantity || !unitCode || !containerNumber || !containerTypeCode) {
      lineErrors.push(
        `Waste line ${displayLineNumber}: quantity, unit code, container count, and container type code are all required once a description is entered.`
      );
      continue;
    }

    const quantityField = {
      quantity,
      unitOfMeasurement: { code: unitCode },
      containerNumber,
      containerType: { code: containerTypeCode },
    };

    // Multiple codes are common on a real waste line (e.g. "D001, D003") —
    // split on commas rather than only supporting one, which RCRAInfo
    // rejects outright as an invalid single code format.
    const federalWasteCodes = w("federalWasteCode")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((code) => ({ code }));

    if (federalWasteCodes.length > 0) {
      const wastewaterCategory = formData.get(`wastewaterCategory_${id}`) === "wastewater" ? "wastewater" : "nonwastewater";
      const isLabPack = formData.get(`labPack_${id}`) === "on";
      wasteLineMetadata.push({ lineNumber: displayLineNumber, wastewaterCategory, isLabPack });
    }

    if (isHazardous) {
      const idNumberCode = w("idNumberCode");
      const rq = formData.get(`rqIndicator_${id}`) === "on";
      // A material can be DOT-hazardous without being a RCRA hazardous
      // waste (e.g. solid vs. liquid sodium hydroxide — only the liquid
      // exhibits the D002 corrosivity characteristic). "Waste" is a
      // conventional prefix on the shipping description, not something
      // baked into any §172.101 table entry (confirmed: zero entries in
      // the parsed table start with "Waste").
      const isRcraWaste = formData.get(`isRcraWaste_${id}`) === "on";
      const shippingName = isRcraWaste ? `Waste ${properShippingName}` : properShippingName;
      // ID number listed first per request — DOT (49 CFR 172.202(b))
      // permits the ID number either immediately before or after the
      // shipping description; this composes it in that order rather
      // than relying on the user to type the whole string correctly.
      const printedDotInformation = [
        idNumberCode || null,
        rq ? "RQ" : null,
        shippingName,
        w("hazardClass") || null,
        w("packingGroup") ? `PG ${w("packingGroup")}` : null,
      ]
        .filter(Boolean)
        .join(", ");

      wastes.push({
        lineNumber: displayLineNumber,
        dotHazardous: true,
        wasteDescription: properShippingName, // ignored by RCRAInfo for hazardous lines, but still a required field
        quantity: quantityField,
        dotInformation: { printedDotInformation, idNumber: { code: idNumberCode } },
        hazardousWaste: federalWasteCodes.length ? { federalWasteCodes } : undefined,
        br: false,
        pcb: false,
        // Distinct from dotHazardous — this is EPA's "is this actually a
        // regulated hazardous waste" flag, not DOT's hazmat flag. Tied to
        // the RCRA waste checkbox rather than hardcoded true, since the
        // two can legitimately disagree (see isRcraWaste comment above).
        epaWaste: isRcraWaste,
      });
    } else {
      wastes.push({
        lineNumber: displayLineNumber,
        dotHazardous: false,
        wasteDescription,
        quantity: quantityField,
        br: false,
        pcb: false,
        epaWaste: false, // CONFIRMED: RCRAInfo rejects true here when dotHazardous is false
      });
    }
  }

  if (lineErrors.length > 0) {
    return { wastes, wasteLineMetadata, lineInstructionNotes, error: lineErrors.join(" ") };
  }
  if (wastes.length === 0) {
    return { wastes, wasteLineMetadata, lineInstructionNotes, error: "Add at least one waste line with a description." };
  }
  return { wastes, wasteLineMetadata, lineInstructionNotes };
}

export interface BuildManifestInputResult {
  input: NewManifestInput;
  wasteLineMetadata: WasteLineMetadataInput[];
  /** Set when validation failed — callers should return this to the user
   * instead of proceeding to save/persist anything. `input`/`wasteLineMetadata`
   * are still populated (partially) in this case but must not be used. */
  error?: string;
}

/**
 * Pure extraction of createManifestAction's form-data -> NewManifestInput
 * composition (manifestActions.ts). Mechanically identical to the logic
 * this was extracted from — same validation messages, same DOT-string
 * field order, same Box-14 combination. No RCRAInfo/Supabase calls happen
 * here; this only touches the FormData it's given.
 */
export function buildNewManifestInputFromFormData(formData: FormData): BuildManifestInputResult {
  const f = (name: string) => (formData.get(name) as string)?.trim() ?? "";
  // RCRAInfo requires phone numbers in exactly 999-999-9999 format and
  // rejects anything else outright — reformats whatever digits the user
  // typed (with/without dashes, a leading "1" country code, spaces) into
  // that shape. Falls back to the raw trimmed input if it can't
  // confidently normalize, so EPA's own validation still catches genuinely
  // malformed numbers instead of this silently passing them through.
  const phoneField = (name: string) => {
    const raw = f(name);
    const digits = raw.replace(/\D/g, "");
    const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (tenDigits.length !== 10) return raw;
    return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
  };

  const input: NewManifestInput = {
    status: "NotAssigned",
    submissionType: "FullElectronic",
    originType: "Web",
    import: false,
    export: false,
    generator: {
      epaSiteId: f("generatorEpaSiteId"),
      name: f("generatorName"),
      mailingAddress: {
        address1: f("generatorAddress1"),
        city: f("generatorCity"),
        state: { code: f("generatorState") },
        country: { code: "US" },
        zip: f("generatorZip"),
      },
      siteAddress: {
        address1: f("generatorAddress1"),
        city: f("generatorCity"),
        state: { code: f("generatorState") },
        country: { code: "US" },
        zip: f("generatorZip"),
      },
      contact: {
        firstName: f("generatorFirstName"),
        lastName: f("generatorLastName"),
        phone: { number: phoneField("generatorPhone") },
        email: f("generatorEmail"),
      },
      emergencyPhone: { number: phoneField("generatorEmergencyPhone") },
    },
    // Filled in below, after validation -- matches the wasteLineIds pattern.
    transporters: [],
    designatedFacility: {
      epaSiteId: f("facilityEpaSiteId"),
      name: f("facilityName"),
      mailingAddress: {
        address1: f("facilityAddress1"),
        city: f("facilityCity"),
        state: { code: f("facilityState") },
        country: { code: "US" },
        zip: f("facilityZip"),
      },
      siteAddress: {
        address1: f("facilityAddress1"),
        city: f("facilityCity"),
        state: { code: f("facilityState") },
        country: { code: "US" },
        zip: f("facilityZip"),
      },
      contact: {
        firstName: f("facilityFirstName"),
        lastName: f("facilityLastName"),
        phone: { number: phoneField("facilityPhone") },
        email: f("facilityEmail"),
      },
      emergencyPhone: { number: phoneField("facilityEmergencyPhone") },
    },
    additionalInfo: undefined, // filled in below, after collecting per-line instructions
    wastes: [], // filled in below, after validation
  };

  // Every transporter row the user added is required (unlike waste lines,
  // there's no "blank optional slot" concept here — each one is explicitly
  // added via "+ Add another transporter"). `order` is the array position,
  // matching EPA's own "Transporter 1"/"Transporter 2"/... numbering
  // (Items 6/7 on the main form, Items 25/26 on continuation sheets).
  const transporterIds = (formData.get("transporterIds") as string).split(",").filter(Boolean);
  input.transporters = transporterIds.map((id, index) => ({
    epaSiteId: (formData.get(`transporterEpaSiteId_${id}`) as string)?.trim() ?? "",
    name: (formData.get(`transporterName_${id}`) as string)?.trim() ?? "",
    order: index + 1,
  }));

  const wasteResult = buildWasteLinesFromFormData(formData);
  if (wasteResult.error) {
    return { input, wasteLineMetadata: wasteResult.wasteLineMetadata, error: wasteResult.error };
  }
  input.wastes = wasteResult.wastes;

  // 40 CFR 263.21(b)(3): if the generator's contract with the initial
  // transporter grants that transporter agency authority to add/substitute
  // additional transporters on the generator's behalf, that has to be
  // declared in Item 14 via this exact sentence. Captured here (creation
  // time) rather than at signing — it's the generator's own contractual
  // assertion, and Item 14 is only ever reliably editable before anyone has
  // signed (see the "transporter locked once InTransit" finding this
  // otherwise ran into).
  const agencyAuthorityGranted = formData.get("agencyAuthorityGranted") === "on";

  const combinedHandlingInstructions = [
    f("handlingInstructions"),
    agencyAuthorityGranted ? AGENCY_AUTHORITY_ITEM_14_TEXT : "",
    ...wasteResult.lineInstructionNotes,
  ]
    .filter(Boolean)
    .join(" | ");
  input.additionalInfo = combinedHandlingInstructions
    ? { handlingInstructions: combinedHandlingInstructions }
    : undefined;

  return { input, wasteLineMetadata: wasteResult.wasteLineMetadata };
}
