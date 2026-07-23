# RCRAInfo / e-Manifest API — Confirmed Schema & Behavior Notes

**Purpose:** Swagger's schema documentation for this API is incomplete or
misleading in several places — it shows example values but not which fields
are actually required, and some field names differ between GET responses
and POST/PUT request bodies. This doc tracks what we've **confirmed by
actually calling the live preprod API**, as opposed to what Swagger's docs
merely suggest. Update this file every time a live call reveals something
new — that's the whole point of it.

**Environment:** `https://rcrainfopreprod.epa.gov/rcrainfo/rest/api/v1`
**Swagger UI:** `https://rcrainfopreprod.epa.gov/rcrainfo/secured/swagger/`
**Client code:** `src/lib/rcrainfo/` (`client.ts`, `types.ts`, `manifest-fixtures.ts`)

Status legend: ✅ confirmed live · ⚠️ partially confirmed / has open questions · ❓ untested, from Swagger docs only

---

## Auth

`GET /auth/{apiId}/{apiKey}` ✅

Returns `{ token, expiration }`. Token lasts ~20 minutes. Use
`Authorization: Bearer <token>` on all subsequent calls. Swagger UI does
**not** automatically carry the token between different endpoint sections —
if you get `E_AccessDenied`, generate a fresh token and re-paste it into
that specific endpoint's "Try it out" form.

## Site Details

`GET /site-details/{siteId}` ✅

Straightforward — returns registered site info. No surprises here.
Confirmed against `VAD000532119`.

## Manifest Tracking Numbers (list)

`GET /emanifest/manifest-tracking-numbers/{siteId}` ✅

Returns a **flat array of MTN strings** (`string[]`), NOT full manifest
objects — no status/dates/etc per entry, despite what you might assume from
the endpoint name.

⚠️ **`VAD000532119` returned several thousand MTNs.** This is a publicly
documented EPA sandbox test site used by many developers simultaneously —
treat this response as shared/noisy data, not anything specific to this
app. Don't build demo UI against it; create your own manifest instead (see
below) for a clean, traceable test case.

## Manifest Retrieve (single)

`GET /emanifest/manifest/{manifestTrackingNumber}` ⚠️

Schema confirmed via Swagger's example response (very large — see
`types.ts` `Manifest` interface for the modeled subset). **Not yet called
live against a real MTN** — do that once we have a real MTN from a
successful save, to confirm the retrieve shape matches what save actually
produces.

## Manifest Save (create) — the complex one

`POST /emanifest/manifest/save` ⚠️ — in progress, iterating via validation errors

**Request format:** multipart form-data, NOT JSON body directly.
- `manifest` field: a JSON-**stringified** string containing the manifest object
- `attachment` field (optional): a file

This tripped us up initially — Swagger's parameter list shows `manifest` as
type `string`, which is easy to misread as "just send JSON", but it must be
form-encoded, and the `Content-Type` header must NOT be manually set (let
`fetch`/the browser set the multipart boundary automatically).

### Confirmed required top-level fields

| Field | Value(s) confirmed | Notes |
|---|---|---|
| `status` | `"NotAssigned"` used successfully | Other values (`Pending`, `Scheduled`) untested |
| `submissionType` | `"FullElectronic"` used | — |
| `originType` | `"Web"` used | — |
| `import` | `false` | **Confirmed required** — omitting it fails with "Mandatory Field is Not Provided" |
| `export` | `false` | **NOT confirmed required** — added speculatively (symmetry with `import`); hasn't been flagged as missing when included, but also never tested by omitting it |
| `shipmentType` | — | **CONFIRMED REJECTED.** Do not include at top level — API returns "Object instance has properties which are not allowed by the schema". May only exist on retrieved/in-flight manifests, not save input. |

### Confirmed required Handler fields (generator / designatedFacility / transporters)

The `Handler` shape (generator, transporters[], designatedFacility) needs:

| Field | Status | Notes |
|---|---|---|
| `epaSiteId` | ✅ required | Must be a real registered site |
| `name` | ✅ required | **Even for a site RCRAInfo already has on file.** A warning confirms submitted name gets discarded and replaced with the registered value — but the field must still be present/non-empty or structural validation fails first. |
| `contact.phone.number` | ✅ required (generator, designatedFacility) | **Field is `phone`, NOT `phoneNumber`** — different from the `SiteContact` shape used in the GET `/site-details` response, which does use `phoneNumber`. This is a genuine inconsistency between this API's GET and POST/save schemas. See `ManifestContact` type in `types.ts`. |
| `emergencyPhone.number` | ✅ required (generator, designatedFacility) | Uses `PhoneNumber` shape directly (not nested under `phone`) — no error was raised on this field once provided, so current shape appears correct. |
| `mailingAddress` / `siteAddress` | ✅ required in practice | Not flagged as its own error, but RCRAInfo's on-file record for `VAD000532119` is apparently incomplete, so supplying it explicitly was necessary to clear a related warning/error. Not yet isolated exactly which sub-fields are mandatory vs. which just fill gaps in the registered record. |

**Transporter-specific:** must be a **real, registered site** — you cannot
invent a site ID. It also needs at least one registered user holding at
least "Preparer" role. EPA publishes known public test transporter sites
for exactly this purpose (see
https://www.epa.gov/e-manifest/how-participate-testing-hazardous-waste-electronic-manifest-system-e-manifest):

- `VAD000532119` — "TEST TSDF OF VA" (Generator and TSDF)
- `VA988177803` — "HEATING AND OIL" (Generator only)
- `VATEST000001` — "TEST TRANSPORTER 1 OF VA" (Generator or Transporter) ← **used successfully in our fixture, cleared all transporter validation errors**
- `VATEST000002` — "TEST TRANSPORTER 2 OF VA" (Generator or Transporter)
- `VATEST000003` — "TEST TSDF OF VA TWO" (Generator and TSDF, web services)
- `VATEST000004` — "TEST GENERATOR OF VA" (Generator only)

Also confirmed: EPA site IDs are capped at **12 characters** — a made-up ID
longer than that fails validation immediately regardless of registration
status.

### Confirmed required WasteLine fields

| Field | Status | Notes |
|---|---|---|
| `dotHazardous` | ✅ required, this exact name | **NOT `hazardous`** — using `hazardous` fails with "properties which are not allowed by the schema". Easy naming trap from the field's conceptual meaning. |
| `dotInformation` | ✅ required for hazardous waste lines | NOT optional as we first assumed from Swagger's example. Sub-fields (`properShippingName`, `idNumber`, `hazardClass`, `packingGroup`) reference EPA's DOT lookup tables via `{code: string}` — **exact valid code values not yet confirmed** against a live lookup endpoint. Current fixture uses placeholder codes for a D001 ignitable liquid (UN1993, class 3, packing group II) — unconfirmed. |
| `wasteDescription` | ⚠️ accepted but functionally ignored for hazardous waste | API returns a warning: "For hazardous Waste, wasteDescription will be ignored" — `dotInformation.properShippingName` is what actually matters for hazardous lines. Presumably still used for non-hazardous lines (untested). |
| `quantity.quantity` + `quantity.unitOfMeasurement.code` | ⚠️ accepted, not yet flagged as wrong | Used `"P"` for pounds — not confirmed against a lookup endpoint, just never flagged as invalid so far. |
| `hazardousWaste.federalWasteCodes` | ⚠️ accepted | Used `D001` — never flagged as invalid, but also not yet confirmed as a real requirement (waste line was still failing on `dotInformation` at time of last test, so this field's validation may not have been reached yet). |
| `lineNumber`, `br`, `pcb`, `epaWaste` | ⚠️ accepted | No errors raised on these; not deeply tested. |

### Known unresolved / open questions

- Is `export` actually required, or was it accepted just because we happened to include it? Try omitting it on a future test.
- What exactly are valid DOT code values for `properShippingName`, `idNumber`, `hazardClass`, `packingGroup`? Check Swagger's `[All] e-Manifest Lookup Services` section for DOT-related lookup endpoints (the confirmed `retrieveContainerTypes` endpoint suggests siblings likely exist for these).
- Which specific mailingAddress/siteAddress sub-fields are actually mandatory vs. just filling gaps in the on-file record for this particular test site? Untested against a site with a fully complete on-file record.
- `status` values other than `"NotAssigned"` — untested.

---

## Changelog

- **2026-07-23, session 1:** Confirmed auth flow, site-details, and
  manifest-tracking-numbers endpoints live. Discovered shared-sandbox data
  volume issue. Found the `manifest/save` endpoint shape (multipart,
  not JSON) and the full `Manifest` GET schema via Swagger.
- **2026-07-23, session 1 (continued), save attempt #1:** First live
  `saveManifest()` call. Confirmed: `shipmentType` rejected at top level,
  `hazardous` should be `dotHazardous`, `import` required, generator/tsdf
  contact phone + emergency phone required, transporter ID must be real
  and ≤12 chars.
- **2026-07-23, session 1 (continued), save attempt #2:** Second live call
  after fixes. Confirmed: `contact.phone` not `contact.phoneNumber`,
  `Handler.name` required even for known sites, `dotInformation` required
  (not optional) for hazardous waste lines.
- **Next planned test:** save attempt #3 with corrected `phone` field,
  `name` fields, and a filled-in `dotInformation` guess. Update this doc
  with the result — either confirm the DOT codes work, or narrow further.
