import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — ManifestMate",
  description:
    "The terms that govern your use of ManifestMate to prepare, sign, and track EPA electronic hazardous waste manifests.",
};

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: (
      <>
        By creating an account, or by using a link ManifestMate sends you to review or sign a
        manifest, you agree to these Terms of Service and our{" "}
        <Link href="/privacy" className="text-brand-blue hover:underline">
          Privacy Policy
        </Link>
        . If you don&apos;t agree, don&apos;t use ManifestMate.
      </>
    ),
  },
  {
    id: "description-of-service",
    title: "Description of service",
    body: (
      <>
        ManifestMate is software that lets hazardous-waste generators, transporters, and disposal
        facilities prepare, sign, and track EPA electronic manifests through the EPA RCRAInfo
        e-Manifest API. ManifestMate does not obtain EPA IDs or RCRAInfo credentials on your
        behalf — those must be obtained directly from EPA and your state, and entered into
        ManifestMate by you.
      </>
    ),
  },
  {
    id: "not-affiliated",
    title: "Not affiliated with EPA",
    body: (
      <>
        ManifestMate is an independent tool built on EPA&apos;s public RCRAInfo/e-Manifest API. It
        is not affiliated with, endorsed by, or operated by the U.S. Environmental Protection
        Agency.
      </>
    ),
  },
  {
    id: "your-account",
    title: "Your account and responsibilities",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>You are responsible for keeping your login credentials and RCRAInfo API Key confidential.</li>
        <li>
          You are responsible for the accuracy of the data you enter into ManifestMate — manifest
          details are submitted directly to EPA&apos;s official system, and ManifestMate does not
          independently verify the regulatory correctness of your submissions.
        </li>
        <li>
          You remain responsible for your own compliance with RCRA, DOT, and any other applicable
          hazardous waste regulations. ManifestMate is a tool that helps you prepare and route
          manifests — it does not provide legal or regulatory compliance advice.
        </li>
        <li>You must have the authority to enter into a manifest transaction on behalf of the company or role you represent.</li>
      </ul>
    ),
  },
  {
    id: "sms-terms",
    title: "SMS / text messaging",
    body: (
      <>
        <p>
          If you provide a phone number, or if someone provides yours, to request an electronic
          signature, you consent to receive text messages from ManifestMate related to that
          request.
        </p>
        <ul className="mt-4 list-disc pl-5 space-y-2">
          <li>Message frequency varies based on use of the service — typically one message per signature request.</li>
          <li>Message and data rates may apply.</li>
          <li>Reply STOP to opt out at any time, or HELP for assistance.</li>
          <li>See our <Link href="/privacy" className="text-brand-blue hover:underline">Privacy Policy</Link> for how we handle phone numbers.</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Don&apos;t use ManifestMate to submit false or fraudulent manifest data.</li>
        <li>Don&apos;t attempt to access another company&apos;s account or data.</li>
        <li>Don&apos;t use ManifestMate to send unsolicited or unrelated text messages to third parties.</li>
        <li>Don&apos;t interfere with or attempt to disrupt ManifestMate&apos;s infrastructure.</li>
      </ul>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <>
        ManifestMate and its branding, design, and software are owned by us. The manifest data you
        enter belongs to you and, once submitted, becomes part of EPA&apos;s official regulatory
        record.
      </>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimer of warranties",
    body: (
      <>
        ManifestMate is provided &quot;as is,&quot; without warranties of any kind. We do not
        guarantee that the service will be uninterrupted, error-free, or that it will meet every
        regulatory requirement applicable to your business.
      </>
    ),
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of liability",
    body: (
      <>
        To the fullest extent permitted by law, ManifestMate is not liable for indirect,
        incidental, or consequential damages arising from your use of the service, including
        regulatory penalties resulting from data you submitted.
      </>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    body: (
      <>
        You may stop using ManifestMate at any time. We may suspend or terminate access to
        accounts that violate these terms.
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: <>These terms are governed by the laws of the Commonwealth of Virginia, without regard to conflict-of-law principles.</>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <>
        We may update these terms as ManifestMate changes. If we make a material change, we will
        update the date below and, where appropriate, notify account holders directly.
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        Questions about these terms? Email us at{" "}
        <a href="mailto:notoreusbfg@gmail.com" className="text-brand-blue hover:underline">
          notoreusbfg@gmail.com
        </a>
        .
      </>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Terms of Service
            </h1>
            <p className="mt-6 text-lg text-gray-700">Last updated August 6, 2026</p>
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
              href="/privacy"
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border-2 border-brand-blue text-brand-blue transition hover:bg-brand-tint"
            >
              Read our Privacy Policy →
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
