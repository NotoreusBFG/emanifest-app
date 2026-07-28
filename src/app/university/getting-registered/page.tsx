import type { Metadata } from "next";
import Link from "next/link";
import { ArticleLayout, Callout, SectionHeading, SubHeading } from "../ArticleLayout";

export const metadata: Metadata = {
  title: "Getting registered: CDX, RCRAInfo, and your EPA ID — Haz Waste University",
  description:
    "Why EPA's registration chain has this many steps, and what's actually happening at each one — CDX/RCRAInfo, your EPA ID, Site Manager roles, and the Electronic Signature Agreement.",
};

export default function GettingRegisteredArticle() {
  return (
    <ArticleLayout
      title="Getting registered: CDX, RCRAInfo, and your EPA ID"
      dek="Before you can create or sign a single manifest electronically, EPA needs to know exactly who you are. Here's why the registration chain has this many links, and what each one is actually doing."
      sources={[
        { label: "EPA e-Manifest user registration overview", href: "https://www.epa.gov/e-manifest/e-manifest-user-registration" },
        { label: "Site Identification Form (EPA Form 8700-12) instructions", href: "https://www.epa.gov/hwgenerators/instructions-and-form-hazardous-waste-generators-transporters-and-treatment-storage" },
        { label: "40 CFR Part 3 (Cross-Media Electronic Reporting — CROMERR)", href: "https://www.ecfr.gov/current/title-40/chapter-I/subchapter-A/part-3" },
        { label: "RCRAInfo Help — Electronic Signature Agreement" },
      ]}
    >
      <p>
        A manifest signature isn&apos;t like clicking &quot;I agree&quot; on a website — it&apos;s a
        legally binding electronic signature that has to hold up the same way a wet-ink signature
        would, under a federal regulation called <strong>CROMERR</strong> (Cross-Media Electronic
        Reporting Regulation, 40 CFR Part 3). CROMERR is why the registration process feels heavier
        than a typical account signup: EPA has to be genuinely sure of your identity before it lets
        you sign anything, not just that you have a working email address.
      </p>

      <SectionHeading>1. Your EPA ID number</SectionHeading>
      <p>
        Every generator needs an EPA ID before anything else — it&apos;s how EPA and your state
        track a specific site, independent of who owns or operates it. You get one by filing the{" "}
        <strong>Site Identification Form (EPA Form 8700-12)</strong>, either through your state
        hazardous waste agency or electronically via RCRAInfo&apos;s <strong>myRCRAid</strong>{" "}
        module, where available.
      </p>

      <SectionHeading>2. A CDX / RCRAInfo account</SectionHeading>
      <p>
        RCRAInfo — the system e-Manifest actually runs on — sits behind EPA&apos;s Central Data
        Exchange (CDX), the shared login EPA uses across several of its reporting systems. As of{" "}
        <strong>August 5, 2024</strong>, every CDX Industry account has to be configured with
        multi-factor authentication through <strong>Login.gov</strong> — a real, recent change
        worth knowing about if you set up an account before then and haven&apos;t logged in since.
      </p>

      <SubHeading>Permission tiers matter</SubHeading>
      <p>
        Not every RCRAInfo user at a site can do the same things. There are real tiers —{" "}
        <strong>Viewer</strong>, <strong>Preparer</strong>, <strong>Certifier</strong>, and{" "}
        <strong>Site Manager</strong> — and only a Site Manager can issue API credentials or grant
        other people permission for the site. EPA specifically recommends every site register{" "}
        <strong>at least two Site Managers</strong>, so one person leaving or losing access
        doesn&apos;t lock the whole site out.
      </p>

      <SectionHeading>3. The Electronic Signature Agreement (ESA)</SectionHeading>
      <p>
        This is the actual CROMERR identity-proofing step, and it&apos;s where the &quot;real
        person, verified&quot; requirement gets satisfied. RCRAInfo offers two paths:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Online identity proofing</strong> (via LexisNexis) — your information is checked
          and scored <strong>immediately</strong>. This is the one worth choosing if it&apos;s
          offered.
        </li>
        <li>
          <strong>Paper, notarized form</strong> — mailed in, and RCRAInfo&apos;s own documentation
          says this can take <strong>two weeks or longer</strong> before you can sign anything.
        </li>
      </ul>

      <SectionHeading>4. Generating your API credentials</SectionHeading>
      <p>
        Once you&apos;re a Site Manager with a completed ESA, RCRAInfo lets you generate an{" "}
        <strong>API ID and Key</strong> under <em>Tools → API</em>. This is the credential pair
        that lets a third-party tool act on your behalf through EPA&apos;s actual e-Manifest
        API — treat it like a password, since anyone holding it can sign on your site&apos;s
        behalf.
      </p>

      <Callout>
        <p className="text-sm">
          This article covers the <em>why</em>. For the actual click-by-click checklist — tracked,
          so you can pick up where you left off, with a short video for each step — see{" "}
          <Link href="/onboarding" className="text-brand-blue hover:underline">
            Get set up with EPA
          </Link>
          .
        </p>
      </Callout>
    </ArticleLayout>
  );
}
