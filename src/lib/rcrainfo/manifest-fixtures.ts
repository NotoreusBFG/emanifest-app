/**
 * A minimal starting payload for testing RcrainfoClient.saveManifest().
 *
 * Revision 5 — updated based on a fourth live 400 validation response
 * (2026-07-23). Only ONE error remained after the printedDotInformation
 * fix: idNumber is required after all. Added it. Generator, designated
 * facility, and transporter are all fully clean; the waste line's
 * dotInformation is now believed COMPLETE. This revision has not yet been
 * tested live — that's the very next step for the next session.
 * See MANIFEST_SCHEMA.md for the full running record.
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
