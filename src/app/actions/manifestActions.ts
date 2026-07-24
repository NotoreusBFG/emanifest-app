"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError, collectManifestOperationWarnings } from "@/lib/rcrainfo/types";
import type { Manifest, NewManifestInput, SiteSearchParams, SiteSearchResultItem, WasteLine } from "@/lib/rcrainfo/types";

function formatRcrainfoError(err: unknown): string {
  if (err instanceof NoCredentialsError) return err.message;
  if (err instanceof RcrainfoApiError) {
    // Save/update validation error bodies have an inconsistent shape
    // (sometimes a flat {message,field,value}, sometimes a nested report) —
    // shown raw rather than guessing a structure that might be wrong.
    return `RCRAInfo error (${err.status}): ${JSON.stringify(err.body)}`;
  }
  return err instanceof Error ? err.message : "Unknown error.";
}

export type LookupManifestState =
  | { success: true; manifest: Manifest }
  | { success: false; error: string }
  | null;

export async function lookupManifestAction(
  prevState: LookupManifestState,
  formData: FormData
): Promise<LookupManifestState> {
  const mtn = (formData.get("mtn") as string)?.trim();
  if (!mtn) return { success: false, error: "Enter a manifest tracking number." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const manifest = await client.getManifest(mtn);
    return { success: true, manifest };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type SiteSearchState =
  | { success: true; sites: SiteSearchResultItem[] }
  | { success: false; error: string };

/**
 * Called directly from the manifest form's site-search autocomplete (not a
 * <form action> — Server Actions can be invoked as plain async functions
 * from client components). Wraps `RcrainfoClient.searchSites()`, which is
 * itself not yet confirmed live — see caveats on `SiteSearchParams`/
 * `SiteSearchResultItem` in `types.ts`.
 */
export async function searchSitesAction(params: SiteSearchParams): Promise<SiteSearchState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const result = await client.searchSites(params);
    return { success: true, sites: result.sites ?? [] };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}

export type CreateManifestState =
  | { success: true; manifestTrackingNumber: string; warnings: string[] }
  | { success: false; error: string }
  | null;

export async function createManifestAction(
  prevState: CreateManifestState,
  formData: FormData
): Promise<CreateManifestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in." };

  const f = (name: string) => (formData.get(name) as string)?.trim() ?? "";

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
        phone: { number: f("generatorPhone") },
        email: f("generatorEmail"),
      },
      emergencyPhone: { number: f("generatorEmergencyPhone") },
    },
    transporters: [
      {
        epaSiteId: f("transporterEpaSiteId"),
        name: f("transporterName"),
        order: 1,
      },
    ],
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
        phone: { number: f("facilityPhone") },
        email: f("facilityEmail"),
      },
      emergencyPhone: { number: f("facilityEmergencyPhone") },
    },
    additionalInfo: undefined, // filled in below, after collecting per-line instructions
    wastes: [], // filled in below, after validation
  };

  // Waste lines are a flat array however many there are — RCRAInfo has no
  // "page"/"continuation" concept at all and auto-paginates the generated
  // PDF itself (confirmed live: 4 lines/1 page, 6 lines/2 pages, 15
  // lines/3 pages, all without us doing anything page-related). Slots with
  // no description entered are treated as unused and dropped, so the form
  // can show 4+ empty slots without forcing every one to be filled — but a
  // line that IS used must have quantity/unit/container filled in, or
  // RCRAInfo hard-rejects it with an empty-string schema error. Validated
  // here, before calling the API, so the user gets a specific "line 3 is
  // missing X" message instead of a raw API error dump.
  const wasteLineIds = (formData.get("wasteLineIds") as string).split(",").filter(Boolean);
  const wastes: WasteLine[] = [];
  const lineErrors: string[] = [];
  const lineInstructionNotes: string[] = [];

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
    const unitCode = w("unitCode");
    const containerNumber = Number(w("containerNumber"));
    const containerTypeCode = w("containerTypeCode");
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
    return { success: false, error: lineErrors.join(" ") };
  }
  if (wastes.length === 0) {
    return { success: false, error: "Add at least one waste line with a description." };
  }
  input.wastes = wastes;

  const combinedHandlingInstructions = [f("handlingInstructions"), ...lineInstructionNotes]
    .filter(Boolean)
    .join(" | ");
  input.additionalInfo = combinedHandlingInstructions
    ? { handlingInstructions: combinedHandlingInstructions }
    : undefined;

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const result = await client.saveManifest(input);
    return {
      success: true,
      manifestTrackingNumber: result.manifestTrackingNumber,
      warnings: collectManifestOperationWarnings(result),
    };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}
