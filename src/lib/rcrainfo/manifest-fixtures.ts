/**
 * A minimal starting payload for testing RcrainfoClient.saveManifest().
 *
 * Revision 3 — updated based on a second live 400 validation response
 * (2026-07-23), which narrowed things further:
 *   - contact info needs `phone`, not `phoneNumber` (different from the
 *     GET site-details response's field naming — see ManifestContact in
 *     types.ts for the full explanation).
 *   - generator.name and designatedFacility.name are required, even
 *     though a warning confirms RCRAInfo discards submitted site info and
 *     substitutes its own registered data once it recognizes the
 *     epaSiteId. Structural validation still demands the field is present.
 *   - wastes[].dotInformation is required for hazardous waste lines (not
 *     optional as revision 1/2 assumed) — wasteDescription gets ignored
 *     in favor of it for hazardous waste per an API warning.
 *
 * Still unconfirmed: the actual valid DOT code values below
 * (properShippingName/idNumber/hazardClass/packingGroup) are placeholders
 * for a D001 ignitable liquid — not yet checked against a lookup endpoint.
 * If the next attempt fails specifically on dotInformation sub-fields,
 * check Swagger's "[All] e-Manifest Lookup Services" section for DOT
 * reference-table endpoints (similar to the container-types one already
 * confirmed) before guessing again.
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
    wastes: [
      {
        lineNumber: 1,
        dotHazardous: true,
        wasteDescription: "Test waste line — ManifestMate dev fixture",
        quantity: {
          quantity: 1,
          unitOfMeasurement: { code: "P" }, // "P" = pounds — not yet confirmed against a lookup endpoint
        },
        dotInformation: {
          properShippingName: { code: "WASTE FLAMMABLE LIQUIDS, N.O.S." }, // placeholder — confirm real code via lookup endpoint
          idNumber: { code: "UN1993" },
          hazardClass: { code: "3" },
          packingGroup: { code: "II" },
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
