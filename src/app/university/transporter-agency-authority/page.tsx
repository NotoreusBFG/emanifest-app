import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, Callout, SectionHeading, SubHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "Changing transporters mid-shipment — Haz Waste University",
  description:
    "A manifest names every transporter before anyone signs — what happens when the real world doesn't cooperate, and how agency authority and transfer facilities fit in.",
};

export default function TransporterAgencyAuthorityArticle() {
  return (
    <ArticleLayout
      title="Changing transporters mid-shipment"
      dek="A manifest locks in every transporter before anyone signs it. So what happens when a truck breaks down, or one company hands off to another partway through the trip?"
      sources={[
        { label: "40 CFR 263.21 (Compliance with the manifest)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-263/subpart-B/section-263.21" },
        { label: "40 CFR 263.12 (Transfer facility requirements)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-263/subpart-B/section-263.12" },
        { label: "40 CFR 260.10 (definition of \"transfer facility\")", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-260/subpart-B/section-260.10" },
      ]}
    >
      <p>
        Every transporter on a shipment has to be named on the manifest before the first
        signature happens. On an electronic manifest, that&apos;s not just good practice — it&apos;s
        enforced by RCRAInfo itself. The moment the manifest moves past &quot;Scheduled&quot; status
        (which happens once the first transporter takes custody), the transporter data locks. No
        API call, correction, or amendment can add or change a transporter after that point — not
        even RCRAInfo&apos;s own post-completion &quot;Correct&quot; tool, which only becomes
        available once the manifest is fully signed, by which time the same lock is still in
        effect.
      </p>
      <p>That raises an obvious question: what happens when reality doesn&apos;t cooperate?</p>

      <SectionHeading>Two real scenarios, one regulation</SectionHeading>
      <p>
        40 CFR 263.21 is the rule that actually governs this — and it covers both of the practical
        situations that come up:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>A transporter genuinely can&apos;t complete the leg</strong> (breakdown, an
          emergency, anything that isn&apos;t simply the facility rejecting the waste) — the
          transporter has to contact the generator and get authorization to revise the transporter
          designation.
        </li>
        <li>
          <strong>One company picks up, a different company delivers</strong> — this is normal,
          planned relay transport, not an emergency. It&apos;s handled through a{" "}
          <strong>transfer facility</strong>: a loading dock, parking area, or similar
          transportation-related location where a shipment can sit briefly between transporters.
        </li>
      </ul>

      <SubHeading>Transfer facilities and the 10-day rule</SubHeading>
      <p>
        Under 40 CFR 263.12, a transporter can hold manifested waste at a transfer facility for{" "}
        <strong>10 days or less</strong> without triggering the permitting requirements that apply
        to actual storage facilities. One detail that&apos;s easy to get wrong: the 10-day clock
        only counts time the waste sits still — EPA guidance is explicit that it{" "}
        <em>&quot;does not apply to the period of time that such waste is actually in transit
        between the pick-up and delivery points.&quot;</em> There&apos;s no separate federal rule
        capping how long a shipment can be on the road overall — only this holding-time limit at a
        transfer point, and the unrelated 90-day accumulation clock generators face before waste
        ever ships in the first place.
      </p>

      <SubHeading>Agency authority — skipping the phone call</SubHeading>
      <p>
        Calling the generator every time a substitution is needed doesn&apos;t scale well for a
        transporter that regularly relays shipments to a second carrier. 40 CFR 263.21(b)(3) has an
        answer: if the generator&apos;s contract with the <strong>initial</strong> transporter
        explicitly grants that transporter authority to add or substitute later transporters on the
        generator&apos;s behalf, the initial transporter can make that call without asking each
        time. The catch is that this authority has to be declared <strong>on the manifest itself</strong> —
        specifically, in Item 14 (Special Handling Instructions), using this exact certifying
        sentence:
      </p>
      <blockquote className="border-l-4 border-brand-blue pl-4 italic text-gray-700">
        &quot;Contract retained by generator confers agency authority on initial transporter to add
        or substitute additional transporters on generator&apos;s behalf.&quot;
      </blockquote>
      <p>
        This only applies to the <strong>initial</strong> transporter (Transporter 1) — it&apos;s
        not something later transporters in the chain can claim for themselves.
      </p>

      <Callout>
        <p className="text-sm">
          Since Item 14 is only reliably editable before anyone has signed, ManifestMate captures
          this at{" "}
          <Link href="/manifests/new" className="text-brand-blue hover:underline">
            manifest creation
          </Link>{" "}
          — a checkbox under the first transporter&apos;s details writes the certifying sentence
          into Item 14 automatically, so it&apos;s part of the manifest from the start rather than
          something added after the fact.
        </p>
      </Callout>

      <SectionHeading>What this doesn&apos;t solve</SectionHeading>
      <p>
        None of this reopens a manifest that&apos;s already moving. Agency authority and transfer
        facilities are both about handling substitutions <em>within the rules as written</em> —
        they don&apos;t create a way to edit a live electronic manifest&apos;s transporter list.
        And regardless of who&apos;s doing the driving at any given moment, the underlying
        regulation is clear that none of this reduces the <strong>generator&apos;s</strong>{" "}
        liability for the waste.
      </p>
    </ArticleLayout>
  );
}
