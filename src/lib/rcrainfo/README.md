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
  /emanifest/manifest-tracking-numbers/{siteId}`. No query params or body;
  it just returns the MTNs tied to a site. Earlier draft of this client
  guessed a `POST /emanifest/search` shape from the Python package's docs —
  that was wrong and has been replaced.

## Suggested next test

The first Swagger attempt against this endpoint returned `E_AccessDenied`
because no bearer token was attached to that specific "Try it out" call —
generate a fresh token (old ones expire in ~20 min) and re-run it with the
`Authorization: Bearer <token>` header set. That'll show whether
`VAD000532119` has existing test manifest history to develop against, or if
it's a blank slate you'll need to seed with an uploaded test manifest first.

## Known dependency: auth bug fix

This client assumes it's called from a context that already knows *which
logged-in ManifestMate user* is making the request (to look up their stored,
encrypted RCRAInfo credentials). That depends on fixing the Supabase
server-side auth bridge (`@supabase/ssr` + `createServerClient`) flagged in
the earlier code review — worth doing before wiring this into a real Server
Action, even though the client itself doesn't depend on it directly.
