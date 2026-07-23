"use server";

import { createClient } from "@/lib/supabase/server";
import { getRcrainfoClientForUser, NoCredentialsError } from "@/services/manifestService";
import { RcrainfoApiError } from "@/lib/rcrainfo/types";
import type { Manifest, NewManifestInput } from "@/lib/rcrainfo/types";

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
  | { success: true; manifestTrackingNumber: string }
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
    // lines/3 pages, all without us doing anything page-related).
    wastes: (formData.get("wasteLineIds") as string)
      .split(",")
      .filter(Boolean)
      .map((id, index) => {
        const w = (name: string) => (formData.get(`${name}_${id}`) as string)?.trim() ?? "";
        return {
          lineNumber: index + 1,
          dotHazardous: formData.get(`dotHazardous_${id}`) === "on",
          wasteDescription: w("printedDotInformation"),
          quantity: {
            quantity: Number(w("quantity")) || 0,
            unitOfMeasurement: { code: w("unitCode") },
            containerNumber: Number(w("containerNumber")) || 1,
            containerType: { code: w("containerTypeCode") },
          },
          dotInformation: {
            printedDotInformation: w("printedDotInformation"),
            idNumber: { code: w("idNumberCode") },
          },
          hazardousWaste: w("federalWasteCode")
            ? { federalWasteCodes: [{ code: w("federalWasteCode") }] }
            : undefined,
          br: false,
          pcb: false,
          epaWaste: true,
        };
      }),
  };

  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    const manifest = await client.saveManifest(input);
    return { success: true, manifestTrackingNumber: manifest.manifestTrackingNumber };
  } catch (err) {
    return { success: false, error: formatRcrainfoError(err) };
  }
}
