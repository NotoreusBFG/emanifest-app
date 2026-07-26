import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, Callout, SectionHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "Waste determination & characterization — Haz Waste University",
  description: "Listed vs. characteristic waste, the four characteristics, and why an accurate waste determination makes everything else easier.",
};

export default function WasteDeterminationArticle() {
  return (
    <ArticleLayout
      title="Waste determination & characterization"
      dek="An accurate waste determination, made once at the point of generation, is what makes every later step — the manifest, the LDR notice, the treatment — actually correct."
      sources={[
        { label: "40 CFR 261.20-261.24 (characteristics of hazardous waste)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-261/subpart-C" },
        { label: "40 CFR 261.31-261.33 (listed hazardous wastes)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-I/part-261/subpart-D" },
      ]}
    >
      <p>
        Before anything else — before a manifest gets created, before an LDR notice gets filed —
        someone has to determine whether a given waste is a RCRA hazardous waste at all, and if so,
        which EPA waste code(s) apply. Get this step wrong and everything downstream inherits the
        mistake: the wrong codes on a manifest, the wrong (or missing) LDR notice, the wrong
        treatment at the disposal facility.
      </p>

      <SectionHeading>Two different ways a waste can be hazardous</SectionHeading>
      <p>There are two entirely separate paths to a waste being regulated, and a single waste can qualify under both:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Listed waste</strong> — EPA has specifically named this waste (or its source) as
          hazardous, regardless of whether it tests as dangerous. These are the F, K, P, and U
          codes (40 CFR 261.31-261.33) — F for waste from common industrial processes (e.g. spent
          solvents), K for waste from specific named industries, and P/U for discarded commercial
          chemical products (P for acutely hazardous, U for everything else).
        </li>
        <li>
          <strong>Characteristic waste</strong> — the waste isn&apos;t specifically named anywhere,
          but it exhibits one of four defined properties. These are the D codes, D001 through D043.
        </li>
      </ul>

      <SectionHeading>The four characteristics</SectionHeading>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>D001 — Ignitability</strong> (40 CFR 261.21): a liquid with a flash point below
          60°C (140°F), a non-liquid that can spontaneously catch fire and burns vigorously, an
          ignitable compressed gas, or a DOT oxidizer.
        </li>
        <li>
          <strong>D002 — Corrosivity</strong> (40 CFR 261.22): an aqueous waste with pH ≤ 2 or ≥
          12.5, or a liquid that corrodes steel at a specified rate.
        </li>
        <li>
          <strong>D003 — Reactivity</strong> (40 CFR 261.23): normally unstable, reacts violently
          with water, generates toxic gas, capable of detonation, or several other specific
          triggers — reactive cyanide and sulfide wastes fall here too.
        </li>
        <li>
          <strong>D004-D043 — Toxicity</strong> (40 CFR 261.24): determined by the Toxicity
          Characteristic Leaching Procedure (TCLP, EPA Method 1311) — a lab test that simulates
          what could leach out of the waste in a landfill, checked against a specific concentration
          limit per constituent (metals like arsenic and lead, or organics like benzene and vinyl
          chloride).
        </li>
      </ul>

      <Callout>
        <p className="text-sm">
          ManifestMate&apos;s manifest form constrains the federal waste code field to RCRAInfo&apos;s
          own live code list, and the LDR notice tool cross-references a curated waste-code reference
          (name, CFR citation, and description) for whatever codes you enter — so you&apos;re picking
          from real codes, and seeing what they actually mean, not typing free text.
        </p>
      </Callout>

      <SectionHeading>Why the determination happens once, at generation</SectionHeading>
      <p>
        A waste&apos;s codes are assigned based on its condition at the point it&apos;s generated —
        not after it&apos;s been diluted, mixed, or treated. That&apos;s a deliberate anti-dilution
        principle running through the whole hazardous waste program: you can&apos;t make a waste
        legally &quot;less hazardous&quot; just by mixing it with something clean. This is also why
        the codes on a manifest matter so much downstream — they&apos;re the receiving facility&apos;s
        starting point for figuring out what land disposal restrictions (covered next) actually
        apply.
      </p>

      <p>
        Next:{" "}
        <Link href="/university/land-disposal-restrictions" className="text-brand-blue hover:underline">
          what happens after a waste has its codes — Land Disposal Restrictions
        </Link>
        .
      </p>
    </ArticleLayout>
  );
}
