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
