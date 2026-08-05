import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, Callout, SectionHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "The manifest & DOT shipping papers — Haz Waste University",
  description: "The Uniform Hazardous Waste Manifest does two jobs at once — a RCRA chain-of-custody record and a DOT shipping paper.",
};

export default function ManifestsAndDotArticle() {
  return (
    <ArticleLayout
      title="The manifest & DOT shipping papers"
      dek="One document, two federal agencies. The manifest satisfies RCRA's chain-of-custody requirement and DOT's shipping-paper requirement at the same time."
      sources={[
        { label: "40 CFR 262.20-262.27 (manifest requirements)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-262/subpart-B" },
        { label: "49 CFR 172.101 (DOT Hazardous Materials Table)", href: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-172/subpart-B/section-172.101" },
        { label: "EPA Form 8700-22 instructions" },
        { label: "PHMSA Hazmat Interpretation Letter Ref. No. 22-0022 (net vs. gross weight on shipping papers)", href: "https://www.phmsa.dot.gov/regulations/title49/interp/22-0022" },
      ]}
    >
      <p>
        It&apos;s easy to think of the manifest as purely a RCRA paperwork requirement. It&apos;s
        actually doing double duty: DOT (the Department of Transportation) separately requires
        shipping papers for any hazardous material in transport, describing what&apos;s being
        shipped and how much. Rather than making generators fill out two different documents, EPA
        designed the manifest to satisfy both requirements in one form.
      </p>

      <SectionHeading>Two questions, answered by one document</SectionHeading>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>DOT&apos;s question:</strong> what material is being shipped, and how much of it?
          — answered by each waste line&apos;s DOT description: proper shipping name, hazard class,
          UN/NA ID number, packing group, and quantity/container information.
        </li>
        <li>
          <strong>RCRA&apos;s question:</strong> who has had possession of this waste, and when was
          it transferred? — answered by the generator/transporter/facility signature chain, each
          with a date.
        </li>
      </ul>

      <SectionHeading>What&apos;s actually on the form</SectionHeading>
      <p>The manifest (EPA Form 8700-22) has three main parts:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Parties</strong> — the generator, one or more transporters (in the order they&apos;ll
          handle the shipment), and the designated (receiving) facility. Each is identified by name,
          address, and EPA ID number.
        </li>
        <li>
          <strong>Waste line items</strong> — one row per distinct waste stream, each with its DOT
          shipping description, quantity and container info, and its EPA hazardous waste code(s)
          (the D/F/K/P/U codes covered in the{" "}
          <Link href="/university/waste-determination" className="text-brand-blue hover:underline">
            waste determination article
          </Link>
          ).
        </li>
        <li>
          <strong>Certifications</strong> — the generator&apos;s signature (certifying the shipment is
          properly described, classified, and packaged — and, for large/small quantity generators,
          that the waste minimization statement under 40 CFR 262.27 is true), each transporter&apos;s
          acknowledgment of receipt, and the designated facility&apos;s certification of receipt.
        </li>
      </ul>

      <Callout>
        <p className="text-sm">
          In ManifestMate, this is exactly what <Link href="/manifests/new" className="text-brand-blue hover:underline">Create a manifest</Link> builds,
          and what each &quot;Sign as…&quot; button on the <Link href="/manifests" className="text-brand-blue hover:underline">lookup page</Link> certifies
          — the signature order (generator → transporter(s) → facility) is enforced by RCRAInfo itself, not just by ManifestMate&apos;s UI.
        </p>
      </Callout>

      <SectionHeading>Net weight or gross weight?</SectionHeading>
      <p>
        DOT lets a shipper report either the <strong>net weight</strong> (the waste itself) or the{" "}
        <strong>gross weight</strong> (waste plus its container/packaging) on a shipping paper — a
        PHMSA interpretation letter (Ref. No. 22-0022) confirms either is acceptable. In practice,
        many experienced preparers default to gross weight anyway, since that&apos;s what a roadside
        inspection is more likely to check against.
      </p>
      <p>
        The tricky case is a <strong>lab pack</strong> containing a small amount of acutely
        hazardous (P-listed) waste packed alongside other materials. Reporting the whole lab pack&apos;s
        gross weight under the acute waste code can make it look like the entire weight is acutely
        hazardous, when only a fraction of it actually is — which can distort a generator&apos;s
        monthly hazardous-waste-generator status determination if that number gets reused elsewhere.
        (That monthly status determination is calculated independently, from actual waste weight —
        it doesn&apos;t pull from manifest data — but an inflated number on the manifest itself can
        still cause confusion later.)
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Where practical, list the acute waste on its own waste line, separate from the rest of the lab pack&apos;s contents.</li>
        <li>
          Use <strong>Box 14 (Special Handling Instructions)</strong> to note the actual acute-waste
          weight, if it&apos;s not obvious from the waste line itself — this is exactly what that
          field is for.
        </li>
        <li>Keep your own packing list or inventory sheet for each lab pack — it&apos;s not a manifest requirement, but it&apos;s what you&apos;ll need if anyone ever asks how you arrived at a quantity.</li>
      </ul>
      <Callout>
        <p className="text-sm">
          In ManifestMate, every waste line has a Special Handling Instructions field that prints
          directly into Box 14 — use it for this kind of clarifying detail whenever a single
          quantity number doesn&apos;t tell the whole story.
        </p>
      </Callout>

      <SectionHeading>If a signed copy doesn&apos;t come back — exception reports</SectionHeading>
      <p>
        The generator&apos;s copy of the manifest is supposed to come back signed by the designated
        facility once the shipment actually arrives and is accepted. If it doesn&apos;t, 40 CFR
        262.42 requires action on a clock:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>At <strong>35 days</strong> after shipment, contact the designated facility to find out what happened.</li>
        <li>
          At <strong>45 days</strong>, if you still don&apos;t have a signed copy, submit an
          exception report to your state/EPA regional office — a letter describing the efforts made
          to locate the waste, plus a copy of the manifest.
        </li>
      </ul>

      <SectionHeading>Keep records</SectionHeading>
      <p>
        Generators must keep signed manifest copies for at least <strong>3 years</strong> from the
        date of shipment. ManifestMate&apos;s{" "}
        <Link href="/dashboard" className="text-brand-blue hover:underline">
          dashboard
        </Link>{" "}
        and stored-document history exist specifically to make that easy — every manifest you create
        or sign through the app stays retrievable long after the fact.
      </p>

      <p>
        Next: <Link href="/university/waste-determination" className="text-brand-blue hover:underline">how a waste gets its codes in the first place</Link>.
      </p>
    </ArticleLayout>
  );
}
