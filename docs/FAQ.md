# ManifestMate — Customer FAQ (Master File)

**Audience note:** unlike the other files in `docs/`, this one is written for
customers and prospects, not for developers — plain language, no internal
implementation detail. Intended as a source to pull from for the website, in-app
help, and sales conversations, not necessarily to publish as-is verbatim.

**Maintenance note:** only include things that are actually built and working.
Several features discussed in engineering sessions (delegated Quick-Sign access,
automated rejection/redirect workflows, multi-transporter timing tracking) are
**not** in this FAQ yet because they aren't built — add them here once they
ship, not before, so this document never overpromises. Update the "Last updated"
line and the environment note below whenever the underlying product changes.

**Last updated:** 2026-07-26 (environment: EPA preprod/testing — see note below).

---

## Table of contents

1. [Getting started](#getting-started)
2. [Creating a manifest](#creating-a-manifest)
3. [Signing & accountability](#signing--accountability)
4. [Chain of custody & transporters](#chain-of-custody--transporters)
5. [Tracking manifests & documents](#tracking-manifests--documents)
6. [Data security](#data-security)

---

## Getting started

### Do I need to register with EPA before I can use ManifestMate?

Yes. Getting your EPA ID number and setting up your RCRAInfo account and API
credentials has to happen directly with EPA and your state — no third-party
tool, including ManifestMate, is allowed to do this on your behalf. Once you
have those credentials, you enter them once in ManifestMate's Settings page,
and ManifestMate handles everything from there.

### Does every employee or driver need their own EPA account to use ManifestMate?

No. EPA's system is built around company-level accounts with role-based
permissions — a "Site Manager" at your company issues API access for the whole
site, not one account per individual. In practice, your company holds one set
of credentials, and any authorized ManifestMate user on your account can
prepare and sign manifests. Individual drivers don't need to personally
register with EPA.

### Is ManifestMate connected to the real EPA system right now?

*(Maintenance note: update this answer when the product goes live on EPA's
production environment — currently accurate as of the date above.)*

ManifestMate is currently connected to EPA's official testing (preprod)
environment while the product is being finalized. Nothing submitted right now
becomes part of the real regulatory record. This notice will be updated
clearly once ManifestMate is live on EPA's production system.

---

## Creating a manifest

### When I click "Save," does that submit my manifest to EPA immediately?

Yes. The moment you save a manifest — whether or not anyone has signed it yet
— it's already created in EPA's official system with a real tracking number.
Saving and signing are two separate steps: saving creates the record; signing
is what each party (generator, transporter, disposal facility) does
afterward to certify their part of it.

### What's the difference between "Save as Draft" and "Save & Sign"?

Both save your manifest to EPA identically — there's no separate EPA-side
"draft" status. The difference is what ManifestMate does next: "Save & Sign"
immediately shows you the option to sign right there; "Save as Draft" just
saves it so you can come back and sign later.

### Can someone else prepare my manifest for me, and I just sign it?

Yes — this is one of the most useful things about how EPA's system works.
Preparing and saving a manifest doesn't require the same permission as
signing it. An office administrator, broker, or anyone else with access to
your account can enter and save the shipment details, and then the actual
generator, transporter, and disposal facility each sign their own part when
ready.

### How do I make sure I'm using the right DOT hazard classification and EPA waste codes?

Search the official 49 CFR §172.101 Hazardous Materials Table directly inside
ManifestMate — by chemical name, or by ID number (like "UN1993") if you
already know it. Select the right match and the hazard class, packing group,
and ID number fill in automatically, instead of being typed from memory.
Federal waste codes work the same way: search and select from EPA's actual
current code list rather than typing codes in freehand.

### Can I look up my transporter or disposal facility instead of typing in their information?

Yes. Search by company name for your generator, transporter, or disposal
facility, and ManifestMate pulls their registered EPA information (address,
EPA ID, contact info) directly, instead of you retyping details already on
file with EPA.

### Can I add more than one transporter to a manifest?

Yes — add as many transporters as your shipment needs. This matters for
relay shipments where waste changes hands between different transport
companies en route to the disposal facility.

### What's the default emergency response phone number, and can I change it?

Every manifest is pre-filled with a default 24/7 emergency response number.
You can change it permanently to your own company's number (or your
emergency response provider's) in Settings, or just override it for a single
manifest while filling it out.

---

## Signing & accountability

### What is the confirmation step when I sign a manifest, and why do I have to check a box?

Before any signature is actually submitted to EPA, ManifestMate shows you the
exact certification language you're agreeing to for that specific role — for
generators, this is EPA's own official certification text from the manifest
form. You have to actively check a box confirming you've read and agree
before the signature can go through. This exists specifically to prevent
accidental signatures — for example, someone meaning to sign as the generator
but clicking the wrong button — since once a signature reaches EPA, it can't
be undone.

### How does ManifestMate prove who actually signed a manifest, and when?

Every signing attempt — successful or not — is recorded in an independent
audit entry, capturing the exact certification language shown, the printed
name entered, a timestamp, and technical details including the IP address
and device used. This is kept in addition to EPA's own official signature
record, giving you independently verifiable proof of who authorized each
signature and when — including in situations where EPA's own record alone
can't tell the full story (see the next question).

### If my company shares login credentials among employees, does EPA's record show which employee actually signed?

No — this is a nuance of how EPA's own system works, not a ManifestMate
limitation. EPA's electronic signature system records whichever account's
credentials were used, not necessarily the specific individual who clicked
the button. If your company shares one set of credentials, EPA's record will
show your company's registered account holder, not the individual employee.
ManifestMate's own internal audit trail is what actually tracks which
specific person triggered a given signature — which is exactly why it
exists.

### Is a signature made through ManifestMate legally the same as signing the paper form?

Yes, for the generator's, transporter's, and receiving facility's *initial*
signatures — ManifestMate uses EPA's official "Quick Sign" electronic
signature method, which EPA has confirmed is legally equivalent to signing
the paper manifest for those steps. The one exception: the disposal
facility's *final* certification submitted to EPA requires EPA's more
rigorous identity-verification process, separate from everyday manifest
signing.

---

## Chain of custody & transporters

### In what order do people need to sign a manifest?

The generator signs first. Then each transporter who takes custody of the
shipment signs to acknowledge receipt. Finally, the disposal facility signs
last, once the waste arrives. EPA's system enforces this overall sequence —
for example, the disposal facility can't sign before a transporter has.

### If waste is transferred from one truck to another, does that always require a new signature?

Only if custody actually changes to a *different* transportation company. If
the same company simply moves your shipment from one of their own trucks to
another — for example, consolidating smaller loads into a full truckload —
no new signature is needed. A new signature is only required when the waste
is handed off to a genuinely different transporter. This is directly how EPA
defines chain of custody for hazardous waste shipments.

### What happens if the disposal facility rejects some or all of my waste shipment?

The original manifest isn't left open or reopened. The facility notes the
rejection on that manifest, and the redirected or returned waste has to be
tracked on a **new** manifest that references the original tracking number.
You can do this today in ManifestMate by creating a new manifest and noting
the original tracking number in that manifest's special instructions —
there isn't yet a dedicated guided workflow for this, but the underlying
process works.

---

## Tracking manifests & documents

### Where can I see all my company's manifests in one place?

Your Dashboard lists every manifest you've created or signed through
ManifestMate, with its current status and a quick view of who has signed so
far.

### How do I know who has signed a manifest, and when?

Every manifest's detail page shows a signature checklist — a checkmark next
to each party (generator, each transporter, disposal facility) along with
the signer's name and the date they signed.

### Where can I get a copy of the completed manifest for my records?

Once a manifest is signed, ManifestMate automatically stores the official
documents EPA generates — the completed manifest PDF and per-signer records
— in your account, so you can view or download them anytime without needing
to go back to EPA's own system.

---

## Data security

### How are my EPA API credentials stored?

Encrypted at rest, and never displayed back to anyone — including you —
after you save them. If you need to change them, you enter new ones; the old
ones are simply overwritten, never shown again.

### Who can see my company's manifest data?

Only your own account. Access is enforced at the database level for every
user, meaning your manifests, documents, and signature records aren't
reachable by any other company's account under any normal use of the
application.
