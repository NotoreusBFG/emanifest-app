# RCRAInfo API client — setup notes

## Where these files go
Drop `types.ts` and `client.ts` into `src/lib/rcrainfo/` in the ManifestMate repo.

## Environment variables
Add to `.env.local` (never commit real values):

```
RCRAINFO_ENV=preprod
RCRAINFO_API_ID=your-api-id
RCRAINFO_API_KEY=your-api-key
```

Regenerate a fresh API Key in the RCRAInfo pre-prod portal (Tools → API)
before using this, since the ID/Key pair used during Swagger testing was
shared in chat and should be treated as compromised.

## Basic usage (server-side only)

```ts
import { RcrainfoClient } from "@/lib/rcrainfo/client";

const client = new RcrainfoClient({
  environment: (process.env.RCRAINFO_ENV as "preprod" | "prod") ?? "preprod",
  credentials: {
    apiId: process.env.RCRAINFO_API_ID!,
    apiKey: process.env.RCRAINFO_API_KEY!,
  },
});

const site = await client.getSiteDetails("VAD000532119");
```

## What's verified vs. not yet verified

- ✅ **Auth flow** (`GET /auth/{apiId}/{apiKey}` → bearer token) — confirmed
  working against the live preprod Swagger UI this session.
- ✅ **Site details** (`GET /site-details/{siteId}`) — confirmed working,
  returned real data for `VAD000532119`.
- ✅ **Manifest tracking numbers** (`getManifestTrackingNumbers` in
  `client.ts`) — confirmed live: `GET
  /emanifest/manifest-tracking-numbers/{siteId}`. Returns a **flat array of
  MTN strings**, not full manifest objects — no status, dates, or site info
  per entry. Fix a fresh token before retrying if you see `E_AccessDenied`;
  tokens expire in ~20 min and Swagger doesn't always carry the
  Authorization header between sections.

## Important finding: shared sandbox data

Querying `VAD000532119` returned several **thousand** MTNs. This site
("Test TSDF of VA") is a publicly documented EPA sandbox test site used by
many developers learning the API — this response is very likely a mix of
everyone's test data, not anything specific to ManifestMate. Don't treat
this as clean data to build/demo the UI against.

## Manifest read/write (new)

- **`getManifest(mtn)`** — `GET /emanifest/manifest/{mtn}`. Returns the full
  manifest record. Confirmed the schema shape via Swagger's example
  response this session (not yet called live against a real MTN).
- **`saveManifest(manifest, attachment?)`** — `POST /emanifest/manifest/save`.
  Confirmed the *endpoint shape* via Swagger (multipart form-data: a
  `manifest` field containing JSON-stringified manifest data, plus an
  optional file attachment) — **not yet confirmed live**. The required
  fields inside that JSON aren't documented by Swagger's schema, so
  `manifest-fixtures.ts` provides a starting payload built from
  `VAD000532119` (known-good, confirmed-registered) as both generator and
  designated facility, with one placeholder waste line.

### Before your first `saveManifest()` test

1. Replace the placeholder transporter (`VATRANSPORTERTEST`) in
   `manifest-fixtures.ts` with a real, registered site ID — check the
   `[All] e-Manifest Lookup Services` section in Swagger for a way to search
   registered sites, or ask in the preprod sandbox docs for a known test
   transporter ID.
2. Confirm valid waste codes and unit-of-measurement codes against Swagger's
   lookup endpoints (e.g. `retrieveContainerTypes` under
   `[All] e-Manifest Lookup Services` — there are likely sibling endpoints
   for unit-of-measurement and waste codes worth checking before assuming
   `"P"` and `"D001"` are valid).
3. Expect the first save attempt to fail with a validation error — that
   error body is the most reliable source of truth for what's actually
   required, more reliable than Swagger's example schema. Iterate the
   fixture based on it.



## Known dependency: auth bug fix

This client assumes it's called from a context that already knows *which
logged-in ManifestMate user* is making the request (to look up their stored,
encrypted RCRAInfo credentials). That depends on fixing the Supabase
server-side auth bridge (`@supabase/ssr` + `createServerClient`) flagged in
the earlier code review — worth doing before wiring this into a real Server
Action, even though the client itself doesn't depend on it directly.
