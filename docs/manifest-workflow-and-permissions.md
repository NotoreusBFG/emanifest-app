# The e-Manifest signing chain: who can do what, and when

Internal reference notes from a working session (2026-07-24), captured for
future reuse — this reads close to something a customer-facing "How it
works" page could be built from, since it answers the question every new
generator/broker prospect is likely to ask: *"can someone else prepare our
manifest for us, or do we have to do the whole thing ourselves?"*

## The short answer

Yes. Creating a manifest and signing it are governed by two different,
much-less-strict-than-you'd-guess permission models in RCRAInfo:

- **Anyone with a registered RCRAInfo industry account can prepare
  (create/save) an unsigned electronic manifest naming any real generator,
  transporter, and disposal facility** — they don't need to be an
  authorized user for those specific sites.
- **Only an account that is specifically authorized (holds "Site Services
  Permission") for a given site can sign on that site's behalf**, and
  signing is enforced in a strict order.

This is what makes a "we prepare it, you just come sign" product model
possible: a third party (a broker, a software tool, ManifestMate itself)
can do the data-entry-heavy work of building a compliant manifest, and the
actual regulated parties only need to log in and click sign.

## The full chain, step by step

1. **A third party creates and saves an unsigned manifest** — a
   `FullElectronic` submission (`POST /emanifest/manifest/save`) naming the
   real generator, transporter(s), and designated (disposal) facility, plus
   the waste line items. RCRAInfo auto-transitions the manifest's status
   from `NotAssigned` to `Scheduled` once the transporter is verified as
   real/registered.
2. **The generator reviews and signs.** They log in with their own
   RCRAInfo-linked account — which *does* hold Site Services Permission for
   their own site — and sign (Quick Sign covers this initial signature; it
   carries the same legal weight as full CROMERR identity-proofed signing
   for this step).
3. **The transporter signs next**, using their own account's permission
   for their own site. RCRAInfo rejects an out-of-order attempt (e.g.
   trying to sign as the disposal facility before the transporter has
   signed) with a hard error.
4. **The disposal (designated) facility signs last**, completing the
   chain. Only this final certification step — the one actually submitted
   to EPA — requires the heavier, full CROMERR identity-proofing flow
   (security questions, registered-user verification). Steps 2–3 don't.

## Why step 1 doesn't require generator/transporter-specific permission

EPA's own API documentation (`docs/Services/authentication.md` in the
public [USEPA/e-manifest](https://github.com/USEPA/e-manifest) repo,
"User Authorization" section) lays out two tiers of authorization checks:

- **Base check, applies to every request:** the calling account must hold
  Site Manager (Industry) permission for *some* site — any site, not
  necessarily the ones on the manifest being acted on. Failing this
  returns `E_IndustryPermissions`.
- **Stricter, per-site checks** (`E_GeneratorAuthorizationSave`,
  `E_DesignatedFacilityAuthorizationSave`, `E_AltFacilityAuthorizationSave`,
  `E_BrokerAuthorizationSave`) — these exist, but are explicitly scoped to
  `Image` / `DataImage5Copy` submission types (i.e. scanned-paper-manifest
  record-keeping submissions), not to `FullElectronic` manifests. A
  separate check, `E_SitePermissions`, is scoped to the Delete/Correct/
  Revert services, not to Save.

Since ManifestMate creates `FullElectronic` manifests, none of the
per-site creation checks apply — only the low base bar.

Signing is the opposite: EPA's own error text, hit live against the
preprod sandbox, is explicit — `E_SystemError: "User does not have Site
Services Permission"` when an account without that permission tries to
sign for a site, even a real, registered one.

## Confirmed live — 2026-07-25

Verified directly against preprod with `scripts/test-create-without-generator-permission.ts`,
naming `VATEST000004` ("TEST GENERATOR OF VA") as the generator — a site this
account has never held Site Services Permission for:

- **Save succeeded cleanly**, no permission error: `POST /emanifest/manifest/save`
  returned `operationStatus: "Saved"`, MTN `100092104ELC`, only the already-known
  warnings (transporter site override, wasteDescription ignored for hazardous
  lines).
- **Signing as that same generator then failed as expected**: `POST
  /emanifest/manifest/quicker-sign` for `siteId: "VATEST000004"` returned
  `E_SystemError: "User does not have Site Services Permission"` — on the *same*
  manifest just created.

Both halves of the claim now independently confirmed live, on the same manifest,
not just read from documentation. The "prepare vs. sign are different permissions"
model is real, not a doc-reading assumption.

## Future idea

This explanation — "prepare vs. sign are different permissions, here's the
chain" — is a strong candidate for an actual customer-facing page (e.g. a
"How e-Manifest signing works" section on the marketing site), now that the
live-test caveat above is closed out. Not built yet.
