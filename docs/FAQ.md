# ManifestMate — Customer FAQ (Master File)

**Audience note:** unlike the other files in `docs/`, this one is written for
customers and prospects, not for developers — plain language, no internal
implementation detail. Intended as a source to pull from for the website, in-app
help, and sales conversations, not necessarily to publish as-is verbatim.

**Maintenance note:** only include things that are actually built and working.
Features discussed in engineering sessions that are **not** built yet (automated
rejection/redirect workflows, multi-transporter timing tracking, Exception Report
filing, paper/hybrid manifests) are not described as available — add them here
once they ship, not before. Delegated Quick-Sign shipped and is covered below.
EPA facts in this file were re-checked against EPA's e-Manifest FAQ, fact sheets,
Remote Signer Policy and Oct 2025 webinar on 2026-11-03; re-check them when the
Paper Manifest Sunset Rule is finalized or EPA publishes new FY fees (due by
July 1, 2027). The public copy of this file is `src/app/faq/page.tsx` — keep them in sync.

**Last updated:** 2026-11-03 (environment: EPA preprod/testing — see note below).

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

Not for ManifestMate. EPA gives each site's Site Manager the ability to create
API credentials for the whole site (only a Site Manager can do this), and your
company enters those credentials once in ManifestMate. People who log into
RCRAInfo directly still need their own individual accounts, because EPA does
not allow shared logins. Drivers and other field employees who can't or don't
register can sign through EPA's "Remote Signer" policy, which ManifestMate's
Quick-Sign delegation is built around (see the Signing section below). Note
that EPA requires large and small quantity generators to be registered with
e-Manifest, and that registrations on EPA's testing site do not carry over to
production.

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
ready. One limit worth knowing: EPA says a broker cannot sign the generator's
part for the generator unless the broker is physically at the generator's site
acting as the offeror who prepared the shipment there. Brokers also need their
own EPA ID number.

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

### Should I enter the net weight or gross weight for a waste line, and where do I note the difference?

Either is generally acceptable — DOT allows shippers to report net weight (the
waste itself) or gross weight (waste plus container/packaging). Many
experienced preparers default to gross weight since that's what a roadside
inspection is more likely to check against. The one case worth extra care is a
lab pack containing a small amount of acutely hazardous waste mixed with other
materials: reporting the whole pack's gross weight under the acute waste code
can make it look like all of it is acutely hazardous. If that's a concern, use
the Special Handling Instructions field on that waste line — it prints
directly into Box 14 on the manifest — to note the actual acute-waste weight
separately. See Haz Waste University's [manifest & DOT shipping papers
article](/university/manifests-and-dot) for more detail.

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

### If my company uses one set of API credentials for several employees, does EPA's record show which employee actually signed?

Partly. EPA's electronic signature records the account whose credentials were
used, so a company's signature made through its API credentials shows the
registered account holder as the electronic signer. Under EPA's Remote Signer
policy, the printed name of the person actually responsible for the shipment
is also entered on the manifest, and ManifestMate sends the name you type when
you sign. ManifestMate's own audit trail separately records which specific
person triggered each signature, along with the certification text shown and a
timestamp. Separately, EPA does not allow people to share personal RCRAInfo
logins — the API credential route is the approved way for a company system to
sign for field staff.

### Is a signature made through ManifestMate legally the same as signing the paper form?

Yes, for the generator's, transporter's, and receiving facility's *initial*
signatures — ManifestMate uses EPA's official "Quick Sign" electronic
signature method, which EPA has confirmed is legally equivalent to signing
the paper manifest for those steps. Quick Sign needs only EPA's "Preparer"
permission. The exceptions: the disposal facility's *final* certification
submitted to EPA, and any post-receipt corrections, require EPA's more
rigorous identity-verification (CROMERR) signature and a Certifier or Site
Manager role.

### Can my driver sign without registering with EPA?

Yes, under EPA's Remote Signer policy, and ManifestMate's Quick-Sign delegation
is built for it. The owner invites the driver in Settings; the driver signs
using the owner's EPA credentials and types their own printed name. EPA's
conditions: the signer must be an employee or contractor of the same company
who has first-hand knowledge of the shipment, and must sign within 24 hours of
receiving the waste or before handing it to another party, whichever comes
first. Transporter signatures are the usual case, so delegation defaults to the
transporter role. The generator signature (Box 15) is a DOT shipper
certification, so it must be made by the generator, the generator's agent on
site, or an offeror who prepared the shipment there — turn on generator-role
delegation only for someone who fits that description.

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

It depends on how the rejection happens, under EPA's manifest rules. If the
facility rejects the *entire* shipment immediately, while the transporter is
still there, the original manifest keeps going: the facility signs it and
forwards the waste to the alternate facility named on it, or returns it to the
generator (who signs the rejection item on that same manifest). If the
rejection is *partial*, or happens after the transporter has left, the rejected
waste has to be tracked on a **new** manifest. ManifestMate doesn't yet have a
guided workflow for either case: for a new manifest, create it and note the
original tracking number in the special instructions.

---

## Tracking manifests & documents

### What if the signed copy of my manifest never comes back?

Generators have to watch for this. If a large or small quantity generator
doesn't have a signed copy within 60 days of the day the initial transporter
accepted the waste, it must submit an Exception Report (large quantity
generators must also start looking for the shipment at 45 days). Since
December 1, 2025, that report is filed electronically through EPA's e-Manifest
system, with at least the Certifier role, and there is no fee. ManifestMate
doesn't file Exception Reports for you yet — you file them in RCRAInfo.

### Does EPA charge a fee, and who pays it?

EPA does not charge generators, transporters, or brokers to register or to
create, sign, or correct manifests. It charges the receiving facility (and
exporters) a fee for each manifest submitted: for fiscal years 2026 and 2027,
$5 for an electronic or hybrid manifest, $7 for data plus a scanned image, and
$25 for a scanned paper image. Facilities may pass this cost back to
generators in their contracts. EPA collects these fees through its own
e-Manifest system, not through ManifestMate.

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
