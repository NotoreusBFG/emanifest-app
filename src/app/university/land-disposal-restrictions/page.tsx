import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, Callout, SectionHeading, SubHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "Land Disposal Restrictions (LDR) — Haz Waste University",
  description: "The manifest tracks where waste goes. LDR governs whether it's actually safe to put in the ground.",
};

export default function LandDisposalRestrictionsArticle() {
  return (
    <ArticleLayout
      title="Land Disposal Restrictions (LDR)"
      dek="The manifest answers 'where did this waste go, and who handled it?' LDR answers an entirely different question: 'is it actually safe to put in the ground?'"
      sources={[
        { label: "40 CFR Part 268, Subpart C-D (Land Disposal Restrictions, treatment standards)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-268" },
        { label: "40 CFR 268.7(a) (generator notice and certification requirements)" },
        { label: "40 CFR 268.48 (Universal Treatment Standards table)" },
      ]}
    >
      <p>
        Before 1984, hazardous waste could legally be buried in a landfill with no treatment
        requirement at all — which is exactly how a lot of groundwater contamination happened. The
        Hazardous and Solid Waste Amendments of 1984 added the Land Disposal Restrictions program
        (40 CFR Part 268) specifically to close that gap: a prohibited waste can only be land
        disposed once it meets a treatment standard, full stop.
      </p>

      <SectionHeading>The disposal prohibition (§268.40)</SectionHeading>
      <p>
        For every waste code, EPA&apos;s treatment standards table specifies one of three kinds of
        requirement:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>A concentration limit on the waste extract (TCLP)</strong> — mostly used for
          metals, and a few organics. The same leaching-simulation test used to determine toxicity
          characteristic waste in the first place, but now checked against a treatment threshold
          rather than a hazard threshold.
        </li>
        <li>
          <strong>A concentration limit on the total waste</strong> — mostly organics, measured as
          the actual amount present in the waste (not just what leaches out).
        </li>
        <li>
          <strong>A specified treatment technology</strong> — not a number at all. The waste must be
          treated using a named method (e.g. <code>CMBST</code> for combustion, <code>DEACT</code>{" "}
          for deactivation, <code>RORGS</code> for reactive organics treatment) — or an equivalent
          technology approved by EPA.
        </li>
      </ul>
      <p>
        Many entries also require the result to separately meet the Universal Treatment Standards
        (40 CFR 268.48) for underlying hazardous constituents — other hazardous properties the waste
        might have beyond the one that got it its code in the first place.
      </p>

      <SubHeading>Wastewater vs. nonwastewater</SubHeading>
      <p>
        Treatment standards are frequently split by whether the waste is a <strong>wastewater</strong>{" "}
        or <strong>nonwastewater</strong> — nonwastewaters generally face stricter standards, since
        they&apos;re more concentrated. A common practical threshold: less than 1% total suspended
        solids and total organic carbon is treated as wastewater; anything above that is
        nonwastewater.
      </p>

      <SubHeading>Subcategories change everything</SubHeading>
      <p>
        The same waste code can have very different standards depending on its subcategory. D001
        (ignitable waste) is the clearest example: general D001 waste has one standard, but the{" "}
        <strong>High-TOC Ignitable Liquids Subcategory</strong> (≥10% total organic carbon,
        nonwastewaters only) has a completely different one — combustion or an equivalent
        technology, not a deactivation standard. Several metal codes (D006, D008, D009, D011) have
        their own subcategories too, for batteries and radioactively contaminated materials
        specifically.
      </p>

      <SectionHeading>The generator&apos;s obligation: a notice, not a treatment</SectionHeading>
      <p>
        Under 40 CFR 268.7(a), the <em>generator&apos;s</em> job isn&apos;t to treat the waste
        themselves in most cases — it&apos;s to tell the receiving facility, in writing, what
        they&apos;re getting:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>The EPA hazardous waste code(s) and applicable treatment subcategory</li>
        <li>Whether it&apos;s a wastewater or nonwastewater</li>
        <li>The constituents of concern (for listed wastes) or the regulated constituent (for toxicity-characteristic wastes)</li>
        <li>Waste analysis data, when available</li>
      </ul>
      <p>
        A small number of situations additionally require a signed <strong>certification</strong> —
        for example, if the waste has already been treated to meet its standard, or if it&apos;s a
        lab pack going to a combustion facility under the alternative standard at 40 CFR
        268.42(c). Most notices don&apos;t require one at all.
      </p>

      <Callout>
        <p className="text-sm">
          This is exactly what{" "}
          <Link href="/ldr/new" className="text-brand-blue hover:underline">
            ManifestMate&apos;s LDR notice tool
          </Link>{" "}
          builds — each waste line picks its own &quot;how must this waste be managed&quot; letter
          (matching the real 40 CFR 268.7(a)(4) options), and the form cross-references a real
          treatment-standard reference table for D001-D043 so you can see the actual applicable
          standard while you fill it out, instead of looking it up separately.
        </p>
      </Callout>

      <SectionHeading>One notice, not one per shipment</SectionHeading>
      <p>
        A genuinely useful detail that&apos;s easy to miss: the notice is required{" "}
        <strong>once</strong> per generator/waste-stream/receiving-facility combination — not
        regenerated for every shipment. A new one is only required if the waste or the receiving
        facility changes. In practice, many facilities still ask for a copy with every manifest
        anyway, but the underlying regulatory requirement is a standing notice, which is exactly how
        ManifestMate&apos;s LDR tool models it — it checks whether an active notice already exists
        for that combination before letting you file a duplicate.
      </p>

      <p>
        Retain a copy of every LDR notice for at least 3 years from the date the waste was last
        shipped, same as manifest recordkeeping.
      </p>
    </ArticleLayout>
  );
}
