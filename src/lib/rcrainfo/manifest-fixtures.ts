/**
 * A minimal starting payload for testing RcrainfoClient.saveManifest().
 *
 * VAD000532119 ("Test TSDF of VA") is used here as generator AND designated
 * facility for simplicity — in reality these would usually be different
 * sites, but using the same known-good, confirmed-registered site for both
 * reduces the number of unknowns on a first test call. Swap in a real
 * transporter EPA ID if you have one; VATRANSPORTERTEST below is a
 * placeholder and will likely need to be replaced with a real registered
 * transporter site ID from the preprod sandbox.
 *
 * Expect this to fail validation on the first attempt — treat the response
 * body as the source of truth for what's actually required, then adjust
 * this fixture and the NewManifestInput type in types.ts to match.
 */

import type { NewManifestInput } from "./types";

export function buildTestManifest(): NewManifestInput {
  return {
    status: "NotAssigned",
    submissionType: "FullElectronic",
    originType: "Web",
    shipmentType: "Domestic",
    generator: {
      epaSiteId: "VAD000532119",
    },
    transporters: [
      {
        epaSiteId: "VATRANSPORTERTEST", // placeholder — replace with a real transporter site ID
        order: 1,
      },
    ],
    designatedFacility: {
      epaSiteId: "VAD000532119",
    },
    wastes: [
      {
        lineNumber: 1,
        hazardous: true,
        wasteDescription: "Test waste line — ManifestMate dev fixture",
        quantity: {
          quantity: 1,
          unitOfMeasurement: { code: "P" }, // "P" = pounds in EPA's unit code table — confirm against Swagger's lookup endpoint
        },
        hazardousWaste: {
          federalWasteCodes: [{ code: "D001" }], // Ignitability — placeholder waste code, replace with a real applicable one
        },
        br: false,
        pcb: false,
        epaWaste: true,
      },
    ],
  };
}
