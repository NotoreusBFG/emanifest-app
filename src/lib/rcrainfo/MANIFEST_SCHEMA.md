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

`GET /emanifest/manifest/{manifestTrackingNumber}` ✅

Confirmed live against a real, app-created manifest (`100091730ELC`,
created by our own `saveManifest()` call — not shared sandbox noise). See
"Confirmed GET-response behavior" under Manifest Save below for what this
call revealed about how save input maps to retrieved output.

## Manifest Save (create) — the complex one

`POST /emanifest/manifest/save` ✅ — first full end-to-end success on attempt #5

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
| `status` | `"NotAssigned"` used successfully on save | ✅ **Confirmed auto-transitions.** GET on the resulting manifest showed `status: "Scheduled"` — `"NotAssigned"` is a save-input value only; RCRAInfo advances it automatically once e.g. the transporter is verified. Other input values (`Pending`, `Scheduled`) as *save* inputs remain untested. |
| `submissionType` | `"FullElectronic"` used | ✅ Round-tripped unchanged on GET. |
| `originType` | `"Web"` sent on save | ⚠️ **GET returned `"Service"`, not `"Web"`.** Another save-vs-retrieve inconsistency, same family as the `phone`/`phoneNumber` issue below — don't assume what you send is what comes back. |
| `import` | `false` | **Confirmed required** — omitting it fails with "Mandatory Field is Not Provided". Round-trips unchanged on GET. |
| `export` | `false` | ✅ **Confirmed required**, same as `import` — omitting it fails validation. Not just speculative symmetry after all. |
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
- `VATEST000001` — "TEST TRANSPORTER 1 OF VA" (Generator or Transporter) ← **used successfully; fully cleared with ZERO errors as of save attempt #3, only the expected "will be overridden" warning**
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
| `dotInformation` | ✅ required for hazardous waste lines | NOT optional as we first assumed from Swagger's example. |
| `dotInformation.printedDotInformation` | ✅ **required, this exact structure** | RCRAInfo wants the full DOT shipping description as **one printed string**, e.g. `"RQ, Waste flammable liquids, n.o.s. (contains xylene), 3, UN1993, PG II"`. |
| `dotInformation.properShippingName` / `.hazardClass` / `.packingGroup` | ❌ **CONFIRMED REJECTED on save** | These structured `{code: string}` sub-objects (present in Swagger's GET example) fail with "properties which are not allowed by the schema" when sent on save. They may be GET-response-only / derived fields, not save inputs. Do not include on save. |
| `dotInformation.idNumber` | ✅ **CONFIRMED required** (save attempt #4) | Error: "Object has missing required properties [idNumber]" — this was the ONLY error remaining after the `printedDotInformation` fix, meaning generator, designatedFacility, transporter, and every other waste-line field are now believed fully clean. |
| `wasteDescription` | ✅ **CONFIRMED dropped, not just ignored** | Save attempt returned a warning: "For hazardous Waste, wasteDescription will be ignored". The follow-up GET confirmed this literally — the field is **entirely absent** from the retrieved waste line, not merely blank/unused. `dotInformation.printedDotInformation` is what actually matters for hazardous lines. Presumably still used for non-hazardous lines (untested). |
| `quantity.quantity` + `quantity.unitOfMeasurement.code` | ✅ **`"P"` confirmed valid** | GET response enriches this to `{ "code": "P", "description": "Pounds" }` — confirms `"P"` is a real, accepted code without needing a separate lookup call. |
| `hazardousWaste.federalWasteCodes` | ✅ **`D001` confirmed valid** | GET response enriches this to `{ "code": "D001", "description": "IGNITABLE WASTE" }` — same enrichment pattern as unitOfMeasurement, confirms the code is real and accepted. |
| `lineNumber`, `br`, `pcb`, `epaWaste` | ✅ accepted, round-trip unchanged | No errors raised; GET shows same values sent. |
| `quantity.containerType` + `quantity.containerNumber` | ⚠️ **optional at Save, but REQUIRED at Update** | Omittable on `save` — GET response shows no `containerType` field and no default applied. But calling `updateManifest()` on a manifest missing these fails with "Mandatory Field is Not Provided" for both. `"DM"` (metal drums/barrels/kegs) confirmed valid — GET enriches it to `{ "code": "DM", "description": "Metal drums, barrels, kegs" }`, same pattern as other codes. See "Manifest Update" section below. |
| `additionalInfo.handlingInstructions` | ✅ **CONFIRMED — renders on the generated PDF** | Manifest-level (not waste-line) field, max 4000 chars per EPA's schema, corresponds to Box 14 "Special Handling Instructions" on Form 8700-22. Not restricted to GET-only. Tested via `updateManifest()` (see below) — confirmed the submitted text literally appears in the `14_instructions` PDF form field. |

### Confirmed GET-response behavior (Handler enrichment)

Confirmed via GET on manifest `100091730ELC` (created by our own save,
2026-07-23): when a `Handler` (generator, transporter, designatedFacility)
resolves to a real registered `epaSiteId`, RCRAInfo **enriches the record
with fields we never sent**, in addition to the "will be overridden"
behavior already documented above:

- `modified` (boolean), `registered` (boolean), `gisPrimary`,
  `canEsign`, `limitedEsign`, `hasRegisteredEmanifestUser` — all appear
  on GET even though save input doesn't include them.
- For the transporter (`VATEST000001`), the registered address and
  contact came back **completely different** from what we submitted —
  real address (`2777 SOUTH CRYSTAL DRIVE`) and a real named contact
  (`SCOTT CHRISTIAN`) replaced our placeholder values entirely. This is
  the practical effect of the "Registered site was found. Provided site
  information will be ignored and replaced" warning — worth knowing
  before assuming placeholder transporter contact info is safe to leave
  in production payloads.
- `correctionInfo: { active: true }` appears on GET — **meaning now
  confirmed against EPA's own JSON schema comments** in
  `Services-Information/Schema/emanifest.json` in the public
  [USEPA/e-manifest](https://github.com/USEPA/e-manifest) repo:
  `CorrectionInfo.active` "Indicates if the Manifest version is active or
  outdated for the industry" (there's also a separate `ppcActive` for
  EPA's internal processing side). `versionNumber` only gets populated
  once a manifest has actually been corrected — explains why we only see
  `active: true` with no `versionNumber` on `100091730ELC`, which has
  never been corrected. **Not yet confirmed against a real correction**
  (i.e. haven't seen `active: false` on an outdated version or
  `versionNumber` increment live) — that would need an actual
  correct-manifest test.
- `electronicSignaturesInfo` appeared on the generator with a
  `humanReadableDocument` entry (`human-readable.html`, ~155KB) — **now
  confirmed fetchable and solved the PDF/printed-document open item, see
  "Manifest Attachments" section below.**

## Manifest Attachments (auto-generated PDF / printed document) ✅

`GET /emanifest/manifest/{manifestTrackingNumber}/attachments` ✅

**Not documented in Swagger at all** — found by reading EPA's own
reference client source
([`emanifest-js/src/client.ts`](https://github.com/USEPA/e-manifest/blob/master/emanifest-js/src/client.ts),
`getManifestAttachments`) and the accompanying docs page
([`docs/Services/Manifest/manifest-attachments.md`](https://github.com/USEPA/e-manifest/blob/master/docs/Services/Manifest/manifest-attachments.md))
in the public [USEPA/e-manifest](https://github.com/USEPA/e-manifest) repo,
after the Swagger UI itself turned out to require an EPA-authenticated
browser session (`/secured/` in its URL) rather than just a bearer token.

**Response format:** `multipart/mixed`, NOT JSON — two parts:
1. `application/json` — the manifest data (same shape as `getManifest()`)
2. `application/octet-stream` — a `.zip` file

Ported EPA's own multipart parser into `src/lib/rcrainfo/parse-multipart.ts`
(RCRAInfo's framing is a nonstandard RFC 1341 variant — safer to reuse
EPA's confirmed-working parser than write a new one from scratch). Added
`RcrainfoClient.getManifestAttachments()` in `client.ts`, and a diagnostic
script `scripts/test-get-attachments.ts`.

**Confirmed live against `100091730ELC`.** The zip contained:

| File | Notes |
|---|---|
| `form-2050.pdf` | ✅ **The actual EPA Form 8700-22, auto-generated by RCRAInfo, pre-filled with our submitted manifest data** — confirmed via the PDF's form fields, e.g. `/T (4_manifestNum) /V (100091730ELC)`. **This means ManifestMate does NOT need to build a custom PDF renderer** — RCRAInfo generates the driver/paper-filing copy automatically for fully electronic manifests. |
| `form-2050_quantities_blank.pdf` | Same form, same manifest number, but with waste-quantity fields left blank — presumably meant for hand-completion of actual measured quantity at pickup time, before the generator's copy is finalized. |
| `cor-g-human-readable.html` (`human-readable.html` in the `electronicSignaturesInfo` metadata) | Bootstrap-styled HTML summary of the manifest/signature state. Secondary to the PDF for the printed-manifest requirement, but may be useful for an in-app "view" page. |

### Known unresolved / open questions

- What exactly are valid DOT code values for `properShippingName`, `idNumber`, `hazardClass`, `packingGroup`? Check Swagger's `[All] e-Manifest Lookup Services` section for DOT-related lookup endpoints (the confirmed `retrieveContainerTypes` endpoint suggests siblings likely exist for these).
- Which specific mailingAddress/siteAddress sub-fields are actually mandatory vs. just filling gaps in the on-file record for this particular test site? Untested against a site with a fully complete on-file record.
- `status` *save-input* values other than `"NotAssigned"` — untested. (Note: `"Scheduled"` is now confirmed as an *output* value the system transitions to automatically.)
- Does `correctionInfo.active` flip to `false` on the superseded version, and does `versionNumber` increment as expected, once we actually test a real manifest correction? (Meaning is understood from EPA's schema comments, but not yet observed live.)
- Why did `originType` come back as `"Service"` when `"Web"` was sent — is this always the case, or specific to how this client's requests are routed?
- Does `form-2050.pdf` regenerate/update if the manifest is corrected after signing, or is it a snapshot from generation time?

## Manifest Signing (`quicker-sign`) ✅

`POST /emanifest/manifest/quicker-sign` ✅ — confirmed live 2026-07-23,
full sign chain completed on `100091730ELC` (Generator → Transporter → Tsdf, status now `"Signed"`)

**Not in Swagger at all.** Found via EPA's public
[USEPA/e-manifest](https://github.com/USEPA/e-manifest) repo, but that repo
contains **two disagreeing sources** for this endpoint's shape:
- `Services-Information/Schema/quicker sign.json` (the formal JSON schema) — uses `siteId`
- `emanifest-js/src/types.ts` (the reference TS client) — uses `siteID`

**`siteId` (the JSON schema's naming) is correct** — confirmed by testing
both.

### The real blocker: Content-Type

Every attempt with `Content-Type: application/json` — even a byte-perfect
JSON body — failed with a generic Tomcat **415 Unsupported Media Type**,
regardless of exact field names. Confirmed this wasn't a fetch/Node quirk
by reproducing it with raw `curl` too. The fix, found essentially by
elimination: **this endpoint wants `Content-Type: text/plain;charset=UTF-8`**
for a JSON-stringified body. Genuinely undocumented anywhere we could find
— not in Swagger, not in either GitHub source. `RcrainfoClient.signManifest()`
sets this explicitly rather than going through the generic `request()`
helper (which always sets `application/json` whenever a body is present).

### Confirmed request shape

```ts
{
  siteId: "VAD000532119",
  siteType: "Generator", // "Transporter" and "Tsdf" documented but untested by us; "RejectionInfo_AlternateTsdf" also documented
  printedSignatureName: "Test Contact",
  printedSignatureDate: "2026-07-23T20:23:21.023Z",
  manifestTrackingNumbers: ["100091730ELC"],
  // transporterOrder: 1, // required only when siteType is "Transporter"
}
```

### Confirmed response shape and behavior

- `operationStatus: "Completed"` came back — **NOT** one of the three
  values EPA's own JSON schema documents (`"AllSigned" | "PartiallySigned"
  | "Failed"`). Treat that enum as incomplete/unreliable.
- `signerReport.firstName` / `.lastName` / `.userId` reflect **whichever
  API credentials made the call** (`"Matthew Gemmell"` / `"NOTOREUSBFG"`
  in our test) — **NOT** the submitted `printedSignatureName` (`"Test
  Contact"`). The printed name is a display value only; the actual signer
  identity is bound to the authenticated API caller. Important for
  ManifestMate's UX/legal framing — whoever's API key is configured for a
  site IS the legal signer, regardless of what name is typed in.
- `signerReport.printedSignatureDate` gets silently normalized to **noon
  UTC of the given date**, discarding whatever time-of-day was sent — a
  warning in the response confirms this explicitly.
- Confirmed the manifest's actual state DOES change immediately:
  - `generator.paperSignatureInfo` appeared on GET with the printed
    name/date.
  - Re-fetching `/attachments` afterward: the generator's PDF signature
    field (`15-2_signature`) now reads **"Provided by Matthew Gemmell"**
    (again, the real API-caller identity, not `printedSignatureName`).
  - A new `cor-t-1-human-readable.html` (transporter's document) appeared
    in the attachments zip **even though the transporter hasn't signed
    yet** — looks like it's generated proactively once the workflow
    advances to that party, not strictly gated on that party's actual
    signature.
  - Top-level `status` remains `"Scheduled"` after only the generator has
    signed — confirms the attachments/PDF endpoint **is available
    mid-workflow**, before full signing completes, not just once
    `"Signed"`.
- **Sequential order is enforced server-side, not just by convention.**
  Attempting to sign out of order (`"Tsdf"` before the transporter had
  signed) failed with `E_SystemError: "Manifest is not ready to be quick
  signed by handler VAD000532119"`. Generator → Transporter(s) in
  `order` → Tsdf is a hard requirement, not just a recommended sequence.
- **Signing as a handler requires your API account to have actual
  permission at that specific site — being a valid, registered EPA site
  ID is NOT enough.** Attempting to sign as Transporter using the
  EPA-documented shared public test site `VATEST000001` failed with
  `E_SystemError: "User does not have Site Services Permission"`. That
  site is real and registered, but our test account isn't an authorized
  user of it. Worked around this by using `updateManifest()` (still
  possible pre-lock) to swap the manifest's transporter to
  `VAD000532119` — our own already-authorized site — reused as
  Transporter even though EPA's own test-site documentation describes it
  as "Generator and TSDF" only; the permission check is account-based, not
  a site-role restriction, so this worked live with no error. Real
  implication for ManifestMate: **a user can only sign as handlers their
  RCRAInfo account is actually registered/authorized for** — this will
  matter a lot for UX (e.g. a generator's staff account signing on behalf
  of a transporter they don't manage won't work).
- **Confirmed the final fully-signed state on `100091730ELC` itself**
  (not just a reference manifest belonging to another developer): status
  transitioned to `"Signed"`, `shippedDate` and `receivedDate` both
  appeared, and all three signature fields on `form-2050.pdf`
  (`15-2_signature` Generator, `17-2_1_signature` Transporter,
  `20-2_signature` Tsdf) read "Provided by Matthew Gemmell" — matching
  the pattern observed on the reference manifest `100064228ELC` exactly.

### What actually makes a signature legitimate (CROMERR "copy of record")

Confirmed via EPA's own CROMERR guidance
([Learn about CROMERR](https://www.epa.gov/cromerr/learn-about-cross-media-electronic-reporting-rule-cromerr),
[Lesson 6: Signature Process](https://www.epa.gov/cromerr/lesson-6-signature-process)):
**there is no separate "control number" or "confirmation code" for an
individual signature.** CROMERR defines a "copy of record" as (1) the
electronic signature logically associated with the document, (2) the
date/time of receipt, and (3) other info establishing the meaning/
circumstances of signing — a bundle, not a lookup ID.

That bundle is exactly what appeared on GET after our live signature —
the full `electronicSignaturesInfo` entry (only partially visible before
we actually signed anything):

```json
{
  "signer": { "firstName": "Matthew", "lastName": "Gemmell", "userId": "NOTOREUSBFG" },
  "signatureDate": "2026-07-23T20:27:31.362+00:00",
  "signerRole": "Industry",
  "signatureMethod": "QuickerSign",
  "humanReadableDocument": { "name": "human-readable.html", "size": 156362, "mimeType": "TEXT_HTML" }
}
```

The `humanReadableDocument` IS the CROMERR "copy of record" artifact —
`signer.userId` + `signatureDate` bound into that document together are
what constitute a legitimate signature, not any discrete ID.

**Important scoping finding — Quick Sign vs. full CROMERR are NOT the
same requirement everywhere:** per EPA's e-Manifest FAQ, Quick Sign
(what `quicker-sign` implements) and full CROMERR-proofed signatures are
*legally identical on the printed manifest*, but they apply to different
steps:
- **Quick Sign** covers the Generator's, Transporter's, and receiving
  facility's **initial** signature (what we just tested).
- **Full CROMERR identity-proofed signing** is specifically required for
  the **designated facility's final certification submitted to EPA**,
  and for **post-receipt corrections**.

This matters for ManifestMate's scope: the heavier CROMERR identity-
proofing UX (security questions, registered-user identity verification,
etc.) is only strictly needed at the TSDF's final-certification step —
not for every signature in the chain.

## Manifest Update ✅

`PUT /emanifest/manifest/update` ✅ — confirmed live 2026-07-23 on `100091730ELC`

Used to answer: **when do quantities/special-handling-instructions get
entered onto the manifest?** Two paths — the initial estimate goes in at
`saveManifest()` time (same as any other waste-line field); if it needs to
change afterward (e.g. actual measured quantity at pickup, or adding
handling notes after the fact), this Update service is how, **as long as
the manifest isn't locked for signing yet** (status `"Pending"` or
`"Scheduled"`, not in the signing queue — confirmed by testing this
successfully on `100091730ELC` even after the Generator had already
signed, since only ONE signature had landed so far, not all of them).

**EPA's own docs page for this endpoint
(`docs/Services/Manifest/update.md`) got BOTH of the following wrong** —
another entry in the growing pile of doc/reality mismatches for this API:

1. **Method:** the docs' HTTP example shows `POST`. Live API returns
   `405`; an `OPTIONS` probe confirmed `Allow: OPTIONS,PUT`. It's `PUT`.
2. **Body format:** the docs' example shows a plain `application/json`
   body. Live API rejects that with a blanket 415 (same failure mode as
   `quicker-sign`, but the *fix* is different this time —
   `text/plain;charset=UTF-8` does NOT work here, only genuine multipart
   form-data does, same shape as `save`: a `manifest` field containing
   the JSON-stringified full manifest object).

Requires the **complete** manifest object (not a partial patch) —
practical pattern: `getManifest()`, mutate the fields you want changed,
send the whole thing back via `updateManifest()`.

### Confirmed request/response behavior

- **`quantity.containerNumber` and `quantity.containerType` are required
  here even though they're optional on `save`** — omitting them fails
  with "Mandatory Field is Not Provided" for both, specifically on
  Update. Discovered by sending back an otherwise-unmodified GET response
  and getting exactly these two errors.
- **`additionalInfo.handlingInstructions` confirmed working** — set it,
  called Update, then re-fetched `/attachments`: the exact submitted text
  appears in the PDF's `14_instructions` form field (Box 14, "Special
  Handling Instructions"). This resolves the open question of where
  special handling instructions live and when they can be entered.
- The response is a **validation report, not the updated Manifest** —
  `{ reportId, operationStatus, warnings, generatorReport, wasteReports,
  ... }`. `operationStatus: "Updated"` on success. Call `getManifest()`
  afterward to see the actual persisted data.
- Sending back the current (already-partially-signed) manifest produced
  harmless warnings, not errors: `Emanifest.status` — status can't be
  changed once signing has started, provided value ignored;
  `generator.paperSignatureInfo` / `generator.electronicSignatures` —
  already-completed signature data can't be modified via Update, provided
  values ignored. None of these blocked the update; they're just EPA
  telling us those specific sub-fields were no-ops.

## Container Type Codes (from EPA manifest instructions — ⚠️ partially live-tested)

Source: EPA's official "Instructions for Completing the Uniform Hazardous
Waste Manifest" (https://www.epa.gov/sites/default/files/2018-05/documents/instructions_for_completing_the_uniform_hazardous_waste_manifest.pdf).
These are documented valid values for `quantity.containerType.code`, but
mostly NOT yet confirmed against the live API's `retrieveContainerTypes`
lookup endpoint — treat as reference, not verified, except where noted.

**Drum, Barrel, and Bag Codes**
| Code | Description |
|---|---|
| `DM` | ✅ **Confirmed valid live** (via `updateManifest()`, 2026-07-23) — Metal drums, barrels, kegs |
| `DF` | Fiberboard or plastic drums, barrels, kegs |
| `DW` | Wooden drums, barrels, kegs |
| `BA` | Burlap, cloth, paper, or plastic bags |

**Box and Carton Codes**
| Code | Description |
|---|---|
| `CM` | Metal boxes, cartons, cases (including roll-offs) |
| `CF` | Fiber or plastic boxes, cartons, cases |
| `CW` | Wooden boxes, cartons, cases |

**Tank and Bulk Codes**
| Code | Description |
|---|---|
| `TT` | Cargo tanks (tank trucks) |
| `TC` | Tank cars |
| `TP` | Portable tanks |
| `DT` | Dump truck |
| `HG` | Hopper or gondola cars |

**Special Codes**
| Code | Description |
|---|---|
| `CY` | Cylinders |

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
- **2026-07-23, session 1 (continued), save attempt #3:** Third live call.
  Transporter fully cleared (zero errors). Confirmed: `dotInformation`
  rejects structured `properShippingName`/`hazardClass`/`packingGroup`
  objects on save — wants a single `printedDotInformation` string instead.
  `idNumber` not flagged either way, left unconfirmed.
- **2026-07-23, session 1 (continued), save attempt #4:** Fourth live call.
  Only ONE error remained: `dotInformation.idNumber` confirmed required.
  Added `idNumber: { code: "UN1993" }` to the fixture (revision 5). **This
  revision has NOT yet been tested live** — session ended before the
  fifth attempt could run. This is the very first thing to do next
  session — it may well succeed outright.
- **Next planned test:** save attempt #5 with `idNumber` added. If this
  succeeds, capture the returned `manifestTrackingNumber` here and use it
  to test `getManifest()` for the first time against a manifest we
  actually created (not shared sandbox noise). If it still fails, the
  error will be new territory — update this doc with whatever it reveals.
- **2026-07-23, session 1 (continued):** Added container type code
  reference table from EPA's official manifest instructions PDF. Not yet
  confirmed against the live API's `retrieveContainerTypes` lookup — ❓
  status until tested.
- **2026-07-23, session 1 (continued), save attempt #5: SUCCESS.**
  Fixture revision 5 saved with zero errors on the first try. Returned
  `manifestTrackingNumber: "100091730ELC"`. Only the two expected/benign
  warnings appeared (transporter site info overridden, wasteDescription
  ignored for hazardous waste). Manifest Save marked ✅.
- **2026-07-23, session 1 (continued), first live `getManifest()` call:**
  Retrieved `100091730ELC` successfully. Manifest Retrieve marked ✅.
  Confirmed: `status` auto-transitions `NotAssigned` → `Scheduled`;
  `originType` came back `"Service"` despite sending `"Web"`;
  `wasteDescription` is fully dropped (not just ignored) for hazardous
  lines; `unitOfMeasurement.code: "P"` and `federalWasteCodes: "D001"`
  both confirmed valid via description enrichment; Handler records get
  enriched with registration metadata and, for the transporter, entirely
  replaced address/contact info; an unexplained `correctionInfo.active:
  true` field appeared; generator carries an `electronicSignaturesInfo`
  block with a `human-readable.html` document that may be relevant to
  the still-open printed-manifest/PDF requirement.
- **2026-07-23, session 2, resolved the printed-manifest/PDF question:**
  Swagger UI turned out to require an authenticated EPA browser session
  (`/secured/`), not just an API token, so switched to reading EPA's
  public [USEPA/e-manifest](https://github.com/USEPA/e-manifest) GitHub
  repo instead. Found the undocumented-in-Swagger
  `GET /emanifest/manifest/{mtn}/attachments` endpoint via EPA's own
  `emanifest-js` reference client. Ported its multipart/mixed parser into
  `parse-multipart.ts`, added `getManifestAttachments()` to `client.ts`,
  and confirmed live against `100091730ELC`: the response zip contains an
  **auto-generated, pre-filled EPA Form 8700-22 PDF** (`form-2050.pdf`),
  a blank-quantities variant, and the `human-readable.html` file. Manifest
  Attachments marked ✅ — **ManifestMate will not need a custom PDF
  renderer.**
- **2026-07-23, session 2 (continued):** `export` confirmed required
  (`types.ts` updated from optional to required, matching `import`).
  `correctionInfo.active`'s meaning confirmed against EPA's own JSON
  schema comments in `Services-Information/Schema/emanifest.json` — see
  "Confirmed GET-response behavior" above for the full explanation.
  RCRAInfo API key rotated.
- **2026-07-23, session 2 (continued), first live `quicker-sign` call:**
  Signed `100091730ELC` as Generator (`VAD000532119`). Took several failed
  attempts to find the right request shape — see "Manifest Signing"
  section for the full story, but in short: the `siteId` field naming
  (not `siteID`), and critically the required
  `Content-Type: text/plain;charset=UTF-8` (NOT `application/json`,
  which gets a blanket 415 from this endpoint specifically). Confirmed
  the real signer identity comes from the API caller's credentials, not
  the submitted `printedSignatureName`. Also used the shared sandbox's
  noisy MTN list productively for once: sampled ~45 MTNs at
  `VAD000532119` and found 19 already-`Signed` manifests, inspected one
  (`100064228ELC`, not ours) to see what a fully-signed PDF/attachments
  response looks like as a safe, read-only reference before signing our
  own.
- **2026-07-23, session 2 (continued), first live `updateManifest()`
  call:** Answered "when do quantities/handling instructions get
  entered" — added `additionalInfo.handlingInstructions` and
  `quantity.containerNumber`/`containerType` to `100091730ELC` (which had
  already been Generator-signed). EPA's docs for this endpoint were wrong
  about both the HTTP method (`PUT`, not the docs' `POST`) and body
  format (multipart like `save`, not the docs' plain JSON). Confirmed
  `handlingInstructions` literally renders in the PDF's `14_instructions`
  field (Box 14). Confirmed `containerNumber`/`containerType` are
  required on Update despite being optional on Save. Updated
  `manifest-fixtures.ts` to revision 6 with both fields included from the
  start.
- **2026-07-23, session 2 (continued):** Researched what legally
  constitutes a legitimate signature. Confirmed via EPA's own CROMERR
  guidance there's no discrete "control number" — the legal record is
  the `electronicSignaturesInfo` bundle (signer identity + timestamp +
  the `humanReadableDocument` copy-of-record artifact), now fully visible
  on GET after our live Generator signature. Also confirmed Quick Sign
  (what `quicker-sign` implements) is legally equivalent to full CROMERR
  signing for the Generator/Transporter/receiving-facility's *initial*
  signature — full CROMERR identity-proofing is only strictly required
  for the designated facility's *final* certification to EPA and for
  post-receipt corrections. See "Manifest Signing" section.
- **2026-07-23, session 2 (continued), completed the full sign chain:**
  `100091730ELC` is now fully `"Signed"`. Hit two real constraints along
  the way: (1) sequential order is server-enforced — signing Tsdf before
  Transporter failed outright; (2) signing as a handler requires the
  API account to have actual site permission there, not just a valid
  registered site ID — our account lacked permission at the shared public
  test transporter `VATEST000001`, so worked around it by using
  `updateManifest()` to swap the transporter to our own already-
  authorized site (`VAD000532119`) before signing. Confirmed the final
  fully-signed PDF matches the reference example's pattern exactly. See
  "Manifest Signing" section for full details.
