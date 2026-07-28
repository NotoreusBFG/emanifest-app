import type { QuickerSignParameters } from "./types";

export interface CertificationText {
  heading: string;
  paragraphs: string[];
  /** Whether `paragraphs` is EPA's own quoted form language vs. a plain-English paraphrase of the regulatory obligation. */
  isVerbatim: boolean;
}

/**
 * Shared between SignManifestPanel.tsx (renders it in the confirmation
 * dialog) and signManifestAction (recomputes it server-side to snapshot
 * into signature_consents — deliberately NOT trusted as a value passed
 * from the client, since the whole point of that audit record is to prove
 * what was actually shown, and a client-supplied value wouldn't prove
 * anything).
 *
 * Only the Generator's certification (Item 15 on EPA Form 8700-22) is a
 * formal, quoted first-person statement in EPA's own manifest instructions
 * — reproduced here verbatim, confirmed against both the official
 * instructions PDF and a real generated manifest PDF. Transporter (Item
 * 17) and designated facility (Item 20) only have a described obligation
 * in the instructions, not a quoted certification paragraph, so their text
 * below is a plain-English paraphrase of that obligation — not EPA's own
 * wording — flagged as such via `isVerbatim` so this distinction doesn't
 * get lost later.
 */
export function certificationTextFor(siteType: QuickerSignParameters["siteType"]): CertificationText {
  if (siteType === "Generator") {
    return {
      heading: "Generator's/Offeror's Certification",
      isVerbatim: true,
      paragraphs: [
        "I hereby declare that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked and labeled/placarded, and are in all respects in proper condition for transport according to applicable international and national governmental regulations. If export shipment and I am the Primary Exporter, I certify that the contents of this consignment conform to the terms of the attached EPA Acknowledgment of Consent.",
        "I certify that the waste minimization statement identified in 40 CFR 262.27(a) (if I am a large quantity generator) or (b) (if I am a small quantity generator) is true.",
      ],
    };
  }

  if (siteType === "Transporter") {
    return {
      heading: "Transporter's Acknowledgment of Receipt",
      isVerbatim: false,
      paragraphs: [
        "By signing, I acknowledge acceptance of the hazardous materials described on this manifest, and certify the date of receipt entered with this signature, on behalf of the transporter named above.",
      ],
    };
  }

  return {
    heading: "Designated Facility Certification of Receipt",
    isVerbatim: false,
    paragraphs: [
      "By signing, I certify receipt of the hazardous materials covered by this manifest, except as noted in any discrepancy recorded for this shipment, on behalf of the facility named above.",
    ],
  };
}

/**
 * 40 CFR 263.21(b)(3): if the generator's contract with the initial
 * transporter grants that transporter agency authority to add or substitute
 * additional transporters on the generator's behalf, that authority must be
 * declared via this exact certifying sentence in Item 14 (Special Handling
 * Instructions) of the manifest — EPA's own regulatory text, not a
 * paraphrase. Shared between SignManifestPanel.tsx (checkbox label) and
 * addAgencyAuthorityNoteAction (what actually gets written to Item 14), so
 * what the transporter agrees to and what gets sent to EPA can never drift
 * apart.
 */
export const AGENCY_AUTHORITY_ITEM_14_TEXT =
  "Contract retained by generator confers agency authority on initial transporter to add or substitute additional transporters on generator's behalf.";
