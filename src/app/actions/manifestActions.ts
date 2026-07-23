"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError, collectManifestOperationWarnings } from "@/lib/rcrainfo/types";
import type { Manifest, NewManifestInput, WasteLine } from "@/lib/rcrainfo/types";

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
    additionalInfo: f("handlingInstructions")
      ? { handlingInstructions: f("handlingInstructions") }
      : undefined,
    // Waste lines are a flat array however many there are — RCRAInfo has no
    // "page"/"continuation" concept at all and auto-paginates the generated
    // PDF itself (confirmed live: 4 lines/1 page, 6 lines/2 pages, 15
    // lines/3 pages, all without us doing anything page-related). Slots
    // with no description entered are treated as unused and dropped, so
    // the form can show 4+ empty slots without forcing every one to be filled.
    wastes: (formData.get("wasteLineIds") as string)
      .split(",")
      .filter(Boolean)
      .map((id): Omit<WasteLine, "lineNumber"> | null => {
        const w = (name: string) => (formData.get(`${name}_${id}`) as string)?.trim() ?? "";
        const isHazardous = formData.get(`dotHazardous_${id}`) === "on";
        const quantity = {
          quantity: Number(w("quantity")) || 0,
          unitOfMeasurement: { code: w("unitCode") },
          containerNumber: Number(w("containerNumber")) || 1,
          containerType: { code: w("containerTypeCode") },
        };

        if (isHazardous) {
          const properShippingName = w("properShippingName");
          if (!properShippingName) return null; // unused slot

          const idNumberCode = w("idNumberCode");
          const rq = formData.get(`rqIndicator_${id}`) === "on";
          // ID number listed first per request — DOT (49 CFR 172.202(b))
          // permits the ID number either immediately before or after the
          // shipping description; this composes it in that order rather
          // than relying on the user to type the whole string correctly.
          const printedDotInformation = [
            idNumberCode || null,
            rq ? "RQ" : null,
            properShippingName,
            w("hazardClass") || null,
            w("packingGroup") ? `PG ${w("packingGroup")}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          return {
            dotHazardous: true,
            wasteDescription: properShippingName, // ignored by RCRAInfo for hazardous lines, but still a required field
            quantity,
            dotInformation: { printedDotInformation, idNumber: { code: idNumberCode } },
            hazardousWaste: w("federalWasteCode")
              ? { federalWasteCodes: [{ code: w("federalWasteCode") }] }
              : undefined,
            br: false,
            pcb: false,
            epaWaste: true, // CONFIRMED: can only be true when dotHazardous is true
          };
        }

        const wasteDescription = w("wasteDescription");
        if (!wasteDescription) return null; // unused slot

        return {
          dotHazardous: false,
          wasteDescription,
          quantity,
          br: false,
          pcb: false,
          epaWaste: false, // CONFIRMED: RCRAInfo rejects true here when dotHazardous is false
        };
      })
      .filter((w): w is Omit<WasteLine, "lineNumber"> => w !== null)
      .map((w, index) => ({ ...w, lineNumber: index + 1 })),
  };

  if (input.wastes.length === 0) {
    return { success: false, error: "Add at least one waste line with a description." };
  }

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
