/**
 * A minimal starting payload for testing RcrainfoClient.saveManifest().
 *
 * Revision 6 — CONFIRMED LIVE end-to-end (save, retrieve, attachments,
 * quicker-sign, and update all tested against this shape). Added
 * `additionalInfo.handlingInstructions` (confirmed renders in Box 14 of
 * the generated PDF) and `quantity.containerNumber`/`containerType`
 * (optional at save, but required if you ever call `updateManifest()` on
 * the resulting manifest — included here so a fresh manifest starts
 * update-ready). See MANIFEST_SCHEMA.md for the full running record.
 */

import type { NewManifestInput } from "./types";

export function buildTestManifest(): NewManifestInput {
  return {
    status: "NotAssigned",
    submissionType: "FullElectronic",
    originType: "Web",
    import: false,
    export: false,
    generator: {
      epaSiteId: "VAD000532119",
      name: "TEST TSDF OF VA", // required for structural validation even though RCRAInfo will override it with the registered name
      mailingAddress: {
        address1: "123 MAIN ST",
        city: "ARLINGTON",
        state: { code: "VA" },
        country: { code: "US" },
        zip: "22202",
      },
      siteAddress: {
        address1: "123 MAIN ST",
        city: "ARLINGTON",
        state: { code: "VA" },
        country: { code: "US" },
        zip: "22202",
      },
      contact: {
        firstName: "Test",
        lastName: "Contact",
        phone: { number: "703-555-0100" },
        email: "test-contact@example.com",
      },
      emergencyPhone: { number: "703-555-0199" },
    },
    transporters: [
      {
        // Real EPA-documented preprod test transporter site.
        epaSiteId: "VATEST000001",
        name: "TEST TRANSPORTER 1 OF VA",
        order: 1,
      },
    ],
    designatedFacility: {
      epaSiteId: "VAD000532119",
      name: "TEST TSDF OF VA",
      mailingAddress: {
        address1: "123 MAIN ST",
        city: "ARLINGTON",
        state: { code: "VA" },
        country: { code: "US" },
        zip: "22202",
      },
      siteAddress: {
        address1: "123 MAIN ST",
        city: "ARLINGTON",
        state: { code: "VA" },
        country: { code: "US" },
        zip: "22202",
      },
      contact: {
        firstName: "Test",
        lastName: "Contact",
        phone: { number: "703-555-0100" },
        email: "test-contact@example.com",
      },
      emergencyPhone: { number: "703-555-0199" },
    },
    additionalInfo: {
      handlingInstructions: "Keep upright. Do not stack. Driver call site 30 min prior to arrival.",
    },
    wastes: [
      {
        lineNumber: 1,
        dotHazardous: true,
        wasteDescription: "Test waste line — ManifestMate dev fixture",
        quantity: {
          quantity: 1,
          unitOfMeasurement: { code: "P" }, // "P" = pounds — not yet confirmed against a lookup endpoint
          containerNumber: 1,
          containerType: { code: "DM" }, // metal drums/barrels/kegs
        },
        dotInformation: {
          printedDotInformation: "RQ, Waste flammable liquids, n.o.s. (contains xylene), 3, UN1993, PG II",
          idNumber: { code: "UN1993" },
        },
        hazardousWaste: {
          federalWasteCodes: [{ code: "D001" }], // Ignitability
        },
        br: false,
        pcb: false,
        epaWaste: true,
      },
    ],
  };
}
