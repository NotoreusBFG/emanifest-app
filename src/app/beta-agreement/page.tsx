import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta Program Terms & Confidentiality Agreement — ManifestMate",
  description:
    "The confidentiality and beta-participation terms every ManifestMate account holder agrees to at signup.",
};

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "beta-status",
    title: "ManifestMate is in beta",
    body: (
      <>
        By creating an account, you&apos;re joining ManifestMate&apos;s beta testing program. The
        product is under active development, may change or break without notice, and should not
        be relied on as your sole system of record for regulatory compliance. This agreement is in
        addition to, not a replacement for, our{" "}
        <Link href="/terms" className="text-brand-blue hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-brand-blue hover:underline">
          Privacy Policy
        </Link>
        , both of which still apply.
      </>
    ),
  },
  {
    id: "confidential-information",
    title: "Confidential information",
    body: (
      <>
        <p>
          As a beta participant you may see product features, workflows, pricing, or business
          information that isn&apos;t publicly released yet (&quot;Confidential Information&quot;).
          You agree to keep it confidential, not share it with anyone outside your own
          organization, and use it only to evaluate and use ManifestMate.
        </p>
        <p className="mt-4">
          Confidential Information does not include anything that&apos;s already public, that you
          already knew before we shared it, that you develop independently, or that you&apos;re
          required to disclose by law.
        </p>
        <p className="mt-4">
          This confidentiality commitment lasts for 2 years from when you accept this agreement.
        </p>
      </>
    ),
  },
  {
    id: "feedback",
    title: "Feedback",
    body: (
      <>
        If you send us feedback, bug reports, or suggestions about the beta, we can use them to
        improve ManifestMate without owing you compensation or attribution. We&apos;re not
        obligated to act on any feedback you give us.
      </>
    ),
  },
  {
    id: "no-warranty",
    title: "No warranty during beta",
    body: (
      <>
        The beta product is provided &quot;as is.&quot; We don&apos;t guarantee it&apos;s complete,
        error-free, or fit for every regulatory purpose you might use it for — you&apos;re
        responsible for verifying anything regulatory-critical independently. We can also change or
        end the beta program at any time.
      </>
    ),
  },
  {
    id: "remedies",
    title: "Remedies",
    body: (
      <>
        A breach of the confidentiality terms above could cause harm that money alone can&apos;t
        fix, so we may seek injunctive relief in addition to any other remedy available to us.
      </>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <>
        This agreement is governed by the laws of the Commonwealth of Virginia, without regard to
        conflict-of-law principles. If any part of it is found unenforceable, the rest stays in
        effect. We may update this agreement as the beta evolves — if we do, the version you
        actually agreed to is recorded on your account.
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        Questions about this agreement? Email us at{" "}
        <a href="mailto:notoreusbfg@gmail.com" className="text-brand-blue hover:underline">
          notoreusbfg@gmail.com
        </a>
        .
      </>
    ),
  },
];

export default function BetaAgreementPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Beta Program Terms &amp; Confidentiality Agreement
            </h1>
            <p className="mt-6 text-lg text-gray-700">Last updated August 28, 2026</p>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-12">
            {sections.map((section) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-brand-navy border-b border-gray-200 pb-3">
                  {section.title}
                </h2>
                <div className="mt-6 text-gray-700 leading-relaxed">{section.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:pb-24 bg-brand-tint">
          <div className="mx-auto max-w-2xl text-center">
            <Link
              href="/terms"
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border-2 border-brand-blue text-brand-blue transition hover:bg-brand-tint"
            >
              Read our Terms of Service →
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 sm:px-12 text-center text-sm text-gray-500 border-t border-gray-200">
        <p>
          ManifestMate is an independent tool built on EPA&apos;s public RCRAInfo/e-Manifest API.
          It is not affiliated with or endorsed by the U.S. Environmental Protection Agency.
        </p>
      </footer>
    </div>
  );
}
