import type { Metadata } from "next";
import { ArticleLayout, Callout, SectionHeading } from "../ArticleLayout";
import { StateCodesBrowser } from "./StateCodesBrowser";

export const metadata: Metadata = {
  title: "State-Specific Hazardous Waste Codes — Haz Waste University",
  description:
    "Several states layer their own hazardous waste codes on top of the federal RCRA D/F/K/P/U system. Which states, and what that means for your manifest.",
};

export default function StateWasteCodesArticle() {
  return (
    <ArticleLayout
      title="State-Specific Hazardous Waste Codes"
      dek="The federal D/F/K/P/U codes aren't always the whole story. A number of RCRA-authorized states layer their own additional waste codes on top — and some manifests need both."
      sources={[
        { label: "California DTSC — Supplemental California Manifest Instructions (rev. 11/15/2017)", href: "https://dtsc.ca.gov/wp-content/uploads/sites/31/2019/06/Supplemental-California-Manifest-Instructions_11-17.pdf" },
        { label: "Texas TCEQ — RG-022, Guidelines for the Classification and Coding of Industrial and Hazardous Wastes", href: "https://www.tceq.texas.gov/permitting/registration/ihw/epa_waste_manifest_system.html" },
        { label: "NEWMOA — Northeast States Hazardous Waste Codes (4/29/2021, covers CT/ME/MA/NH/NJ/RI/VT)", href: "https://www.newmoa.org/wp-content/uploads/2022/07/New-England-State-Waste-Codes-2021.pdf" },
        { label: "New York NYSDEC — 6 NYCRR Parts 371.4(e) and 372.2(b)(2)(ii)" },
        { label: "Washington Dept. of Ecology — WAC 173-303-100" },
        { label: "Pennsylvania DEP — 25 Pa. Code Chapters 260a-266a" },
      ]}
    >
      <p>
        RCRA gives EPA — and any state authorized to run its own hazardous waste program in
        EPA&apos;s place — the authority to regulate hazardous waste (see{" "}
        <a href="/university/rcra-basics" className="text-brand-blue hover:underline">
          RCRA basics
        </a>
        ). Most authorized states rely entirely on the federal D/F/K/P/U waste codes. A handful
        don&apos;t — they add their own supplemental codes on top, either because they regulate
        some wastes as hazardous that the federal rules don&apos;t reach, or because they want a
        record of how a waste is being managed that the federal codes don&apos;t capture.
      </p>

      <SectionHeading>Two different jobs, sometimes on the same line</SectionHeading>
      <p>
        Not every state code identifies a substance. California&apos;s and Massachusetts&apos;s
        codes work like RCRA&apos;s — each one names a specific waste type. Texas&apos;s is
        different: it&apos;s a formula the generator assembles themselves (a sequence number they
        register, a form code, and a classification letter), not a fixed list to look up. New
        York&apos;s and Washington&apos;s are different again — some of their codes describe how a
        waste will be handled or why it qualifies as hazardous under state-specific criteria,
        not what it chemically is. Always check which kind of code a given state expects before
        assuming one substitutes for another.
      </p>

      <Callout>
        <p className="text-sm text-gray-700">
          <strong>Where ManifestMate stands today:</strong> this page is reference material only.
          The manifest creation form doesn&apos;t yet capture or submit a state waste code — see
          the note on the manifest form when a generator or designated facility is in one of the
          states below. EPA&apos;s e-Manifest system does have real, dedicated fields for this
          (confirmed against its own schema — a generator-state field, a facility-state field, and
          a separate one just for Texas&apos;s code format), so submitting one electronically is
          possible; ManifestMate just doesn&apos;t build the field for you yet.
        </p>
      </Callout>

      <SectionHeading>State-by-state reference</SectionHeading>
      <p>
        Search or browse below. States marked &quot;confirmed — no supplemental codes&quot; have
        been specifically checked, not just left out. Any state not listed here simply
        hasn&apos;t been researched yet — that&apos;s not the same as confirmed-clean.
      </p>

      <StateCodesBrowser />

      <p className="text-xs text-gray-400">
        Compiled 2026-07-27 from the cited sources. Not legal advice, and not a live regulatory
        feed — always confirm against the current version of the cited regulation or agency
        guidance before relying on this for an actual shipment.
      </p>
    </ArticleLayout>
  );
}
