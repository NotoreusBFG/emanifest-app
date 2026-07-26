import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, SectionHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "RCRA basics & cradle-to-grave — Haz Waste University",
  description: "What RCRA is, how the hazardous waste program got here, and what cradle-to-grave tracking actually means.",
};

export default function RcraBasicsArticle() {
  return (
    <ArticleLayout
      title="RCRA basics & cradle-to-grave"
      dek="Every manifest ManifestMate creates exists because of one law. Here's what it actually requires, and why."
      sources={[
        { label: "40 CFR Parts 260-299 (RCRA Subtitle C regulations)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I" },
        { label: "EPA: Resource Conservation and Recovery Act (RCRA) Overview", href: "https://www.epa.gov/rcra" },
      ]}
    >
      <p>
        RCRA — the Resource Conservation and Recovery Act — is the 1976 federal law that governs
        how hazardous waste gets handled from the moment it&apos;s generated until it&apos;s finally
        disposed of. &quot;Subtitle C&quot; of RCRA is specifically the hazardous waste program;
        it&apos;s the part that gives EPA (and authorized states) the authority to require
        manifests, permits for treatment/storage/disposal facilities, and the land disposal
        restrictions covered elsewhere in Haz Waste University.
      </p>

      <SectionHeading>It wasn&apos;t always this strict</SectionHeading>
      <p>
        RCRA didn&apos;t appear out of nowhere. Earlier federal waste law was much narrower:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Solid Waste Disposal Act (1965)</strong> — the first federal solid waste law, but
          with no hazardous-waste-specific requirements at all.
        </li>
        <li>
          <strong>Resource Recovery Act (1970)</strong> — shifted focus toward recovering energy and
          materials from waste rather than just disposing of it, but still had no cradle-to-grave
          tracking, and open dumping of waste was still legal.
        </li>
        <li>
          <strong>RCRA (1976)</strong> — introduced the modern hazardous waste framework: waste
          identification, generator/transporter/facility standards, and manifest tracking.
        </li>
        <li>
          <strong>HSWA — the Hazardous and Solid Waste Amendments (1984)</strong> — added, among
          other things, the Land Disposal Restrictions program, in direct response to
          contamination from waste that had been land-disposed without any treatment requirement.
        </li>
        <li>
          <strong>The Hazardous Waste Electronic Manifest Establishment Act (2012)</strong> —
          created the legal basis for e-Manifest, the system ManifestMate connects to today.
        </li>
      </ul>

      <SectionHeading>&quot;Cradle to grave,&quot; concretely</SectionHeading>
      <p>
        The phrase means exactly what it sounds like: once waste is generated, its regulatory
        record follows it through every hand it passes through, all the way to final disposal.
        In practice that's a chain of custody with named links —
      </p>
      <p className="font-medium text-brand-navy">Generator → Transporter(s) → Treatment/Disposal Facility</p>
      <p>
        — and the manifest (covered in the next article) is the actual paper (or now, electronic)
        trail that proves who had the waste at every step. That's also why signatures happen in a
        strict order in ManifestMate: the generator certifies first, each transporter acknowledges
        receipt in turn, and the designated facility certifies last. RCRAInfo enforces that a
        transporter can&apos;t sign before the generator has, and a facility can&apos;t sign before
        the last transporter has.
      </p>

      <SectionHeading>Generator categories set the compliance bar</SectionHeading>
      <p>
        Not every generator faces the same requirements. 40 CFR 262.13 splits generators into three
        tiers based on how much hazardous waste they generate per month — Very Small Quantity
        Generator (VSQG), Small Quantity Generator (SQG), and Large Quantity Generator (LQG) — with
        LQGs facing the strictest recordkeeping, storage time limits, and reporting obligations.
        Which tier you&apos;re in affects things like biennial reporting requirements, but the core
        manifest and LDR obligations covered elsewhere in Haz Waste University apply broadly across
        all three.
      </p>

      <p>
        Next: <Link href="/university/manifests-and-dot" className="text-brand-blue hover:underline">how the manifest itself works</Link>.
      </p>
    </ArticleLayout>
  );
}
