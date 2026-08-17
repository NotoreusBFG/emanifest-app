import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ManifestMate",
  description:
    "How ManifestMate collects, uses, and protects your information, including phone numbers used for signature-request text messages.",
};

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        ManifestMate (&quot;ManifestMate,&quot; &quot;we,&quot; &quot;us&quot;) provides software
        that lets hazardous-waste generators, transporters, and disposal facilities prepare, sign,
        and track EPA electronic manifests through the EPA RCRAInfo e-Manifest API. This policy
        explains what information we collect, how we use it, and who we share it with. It applies
        to everyone who uses ManifestMate, including people who never create an account but
        receive a text or email asking them to review and sign a manifest.
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong>Account information:</strong> your email address and password, if you create a
          ManifestMate account.
        </li>
        <li>
          <strong>RCRAInfo API credentials:</strong> the API ID and API Key you generate in EPA&apos;s
          RCRAInfo system, which we store encrypted so ManifestMate can act on your behalf when
          creating, looking up, or signing manifests. We never see or generate these credentials
          ourselves — EPA issues them directly to you.
        </li>
        <li>
          <strong>Phone numbers:</strong> when you or someone at your company enters a phone
          number to request an electronic signature from a generator, transporter, driver, or
          other signer, we collect that number to send the signature-request text message.
        </li>
        <li>
          <strong>Business information:</strong> company name and EPA Site ID for registered
          transporter companies, and a randomly generated 4-digit signing code (MMIN) per
          manifest, which we store encrypted so it can be displayed to you and, where applicable,
          the assigned transporter.
        </li>
        <li>
          <strong>Manifest data:</strong> the waste, generator, transporter, and disposal-facility
          details you enter to create or sign a manifest. This data is submitted directly to EPA&apos;s
          RCRAInfo system as part of the manifest itself.
        </li>
        <li>
          <strong>Standard technical data:</strong> IP address and basic usage logs collected
          automatically by our hosting infrastructure, the same way most web applications do.
        </li>
      </ul>
    ),
  },
  {
    id: "how-we-use-information",
    title: "How we use your information",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>To create, look up, and sign hazardous waste manifests on your behalf via EPA&apos;s RCRAInfo API.</li>
        <li>To send you (or someone you designate) a text or email when a manifest needs review or an electronic signature.</li>
        <li>To authenticate your account and keep your data separated from every other company&apos;s data.</li>
        <li>To operate, maintain, and improve ManifestMate.</li>
      </ul>
    ),
  },
  {
    id: "sms-text-messaging",
    title: "SMS / text messaging",
    body: (
      <>
        <p>
          ManifestMate uses text messages to notify generators, transporters, and drivers that a
          hazardous waste manifest is ready for their review and electronic signature. A few
          specifics:
        </p>
        <ul className="mt-4 list-disc pl-5 space-y-2">
          <li>
            <strong>We do not sell, rent, or share your mobile phone number with third parties for
            their own marketing purposes.</strong> Your number is used solely to deliver
            ManifestMate&apos;s own transactional messages, sent through our messaging provider
            (Twilio) acting on our behalf.
          </li>
          <li>
            <strong>Message frequency varies</strong> based on your use of the service — typically
            one message per signature request. We do not send recurring or scheduled marketing
            texts.
          </li>
          <li>
            <strong>Message and data rates may apply</strong>, depending on your mobile carrier
            and plan.
          </li>
          <li>
            You can opt out of text messages at any time by replying <strong>STOP</strong> to any
            message. Reply <strong>HELP</strong> for assistance.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-share-information",
    title: "How we share information",
    body: (
      <>
        <p>We share information only as needed to operate ManifestMate:</p>
        <ul className="mt-4 list-disc pl-5 space-y-2">
          <li>
            <strong>EPA RCRAInfo:</strong> manifest data you submit is sent directly to EPA&apos;s
            e-Manifest system — that is the core, required function of the service.
          </li>
          <li>
            <strong>Twilio:</strong> our SMS provider, used solely to deliver the text messages
            described above.
          </li>
          <li>
            <strong>Resend:</strong> our email provider, used to deliver signature-request and
            account emails.
          </li>
          <li>
            <strong>Supabase and Vercel:</strong> our database and hosting providers, who store and
            serve ManifestMate&apos;s infrastructure.
          </li>
        </ul>
        <p className="mt-4">
          We do not sell your personal information, and we do not share it with any other third
          party for their own advertising or marketing purposes.
        </p>
      </>
    ),
  },
  {
    id: "data-security",
    title: "Data security",
    body: (
      <>
        Your RCRAInfo API credentials and each manifest&apos;s signing code (MMIN) are encrypted at
        rest, and never transmitted in plain text outside your own account&apos;s dashboard views.
        Access to your account&apos;s data is enforced
        at the database level, so it is not reachable by any other company&apos;s account under
        normal use of the application.
      </>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices",
    body: (
      <>
        You can update or remove your RCRAInfo API credentials at any time from your account
        settings. You can stop receiving text messages at any time by replying STOP. To request
        access to, correction of, or deletion of your personal information, contact us using the
        details below.
      </>
    ),
  },
  {
    id: "childrens-privacy",
    title: "Children's privacy",
    body: (
      <>
        ManifestMate is a business tool intended for use by adults acting on behalf of a company.
        It is not directed at, and we do not knowingly collect information from, anyone under 18.
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        We may update this policy as ManifestMate changes. If we make a material change, we will
        update the date below and, where appropriate, notify account holders directly.
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        Questions about this policy or your information? Email us at{" "}
        <a href="mailto:notoreusbfg@gmail.com" className="text-brand-blue hover:underline">
          notoreusbfg@gmail.com
        </a>
        .
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Privacy Policy
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
