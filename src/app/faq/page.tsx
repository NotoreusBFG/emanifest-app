import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — ManifestMate",
  description:
    "Answers about getting started, creating and signing e-Manifests, chain of custody, tracking, and data security in ManifestMate.",
};

interface Entry {
  question: string;
  answer: React.ReactNode;
}

interface Section {
  id: string;
  title: string;
  entries: Entry[];
}

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    entries: [
      {
        question: "Do I need to register with EPA before I can use ManifestMate?",
        answer: (
          <>
            Yes. Getting your EPA ID number and setting up your RCRAInfo account and API
            credentials has to happen directly with EPA and your state — no third-party tool,
            including ManifestMate, is allowed to do this on your behalf. Once you have those
            credentials, you enter them once in ManifestMate&apos;s Settings page, and
            ManifestMate handles everything from there.
          </>
        ),
      },
      {
        question: "Does every employee or driver need their own EPA account to use ManifestMate?",
        answer: (
          <>
            No. EPA&apos;s system is built around company-level accounts with role-based
            permissions — a &quot;Site Manager&quot; at your company issues API access for the
            whole site, not one account per individual. In practice, your company holds one set
            of credentials, and any authorized ManifestMate user on your account can prepare and
            sign manifests. Individual drivers don&apos;t need to personally register with EPA.
          </>
        ),
      },
      {
        question: "Is ManifestMate connected to the real EPA system right now?",
        answer: (
          <>
            ManifestMate is currently connected to EPA&apos;s official testing (preprod)
            environment while the product is being finalized. Nothing submitted right now becomes
            part of the real regulatory record. This notice will be updated clearly once
            ManifestMate is live on EPA&apos;s production system.
          </>
        ),
      },
    ],
  },
  {
    id: "creating-a-manifest",
    title: "Creating a manifest",
    entries: [
      {
        question: "When I click “Save,” does that submit my manifest to EPA immediately?",
        answer: (
          <>
            Yes. The moment you save a manifest — whether or not anyone has signed it yet —
            it&apos;s already created in EPA&apos;s official system with a real tracking number.
            Saving and signing are two separate steps: saving creates the record; signing is what
            each party (generator, transporter, disposal facility) does afterward to certify their
            part of it.
          </>
        ),
      },
      {
        question: "What’s the difference between “Save as Draft” and “Save & Sign”?",
        answer: (
          <>
            Both save your manifest to EPA identically — there&apos;s no separate EPA-side
            &quot;draft&quot; status. The difference is what ManifestMate does next: &quot;Save
            &amp; Sign&quot; immediately shows you the option to sign right there; &quot;Save as
            Draft&quot; just saves it so you can come back and sign later.
          </>
        ),
      },
      {
        question: "Can someone else prepare my manifest for me, and I just sign it?",
        answer: (
          <>
            Yes — this is one of the most useful things about how EPA&apos;s system works.
            Preparing and saving a manifest doesn&apos;t require the same permission as signing
            it. An office administrator, broker, or anyone else with access to your account can
            enter and save the shipment details, and then the actual generator, transporter, and
            disposal facility each sign their own part when ready.
          </>
        ),
      },
      {
        question: "How do I make sure I’m using the right DOT hazard classification and EPA waste codes?",
        answer: (
          <>
            Search the official 49 CFR §172.101 Hazardous Materials Table directly inside
            ManifestMate — by chemical name, or by ID number (like &quot;UN1993&quot;) if you
            already know it. Select the right match and the hazard class, packing group, and ID
            number fill in automatically, instead of being typed from memory. Federal waste codes
            work the same way: search and select from EPA&apos;s actual current code list rather
            than typing codes in freehand.
          </>
        ),
      },
      {
        question: "Can I look up my transporter or disposal facility instead of typing in their information?",
        answer: (
          <>
            Yes. Search by company name for your generator, transporter, or disposal facility, and
            ManifestMate pulls their registered EPA information (address, EPA ID, contact info)
            directly, instead of you retyping details already on file with EPA.
          </>
        ),
      },
      {
        question: "Can I add more than one transporter to a manifest?",
        answer: (
          <>
            Yes — add as many transporters as your shipment needs. This matters for relay
            shipments where waste changes hands between different transport companies en route to
            the disposal facility.
          </>
        ),
      },
      {
        question: "What’s the default emergency response phone number, and can I change it?",
        answer: (
          <>
            Every manifest is pre-filled with a default 24/7 emergency response number. You can
            change it permanently to your own company&apos;s number (or your emergency response
            provider&apos;s) in Settings, or just override it for a single manifest while filling
            it out.
          </>
        ),
      },
    ],
  },
  {
    id: "signing-accountability",
    title: "Signing & accountability",
    entries: [
      {
        question: "What is the confirmation step when I sign a manifest, and why do I have to check a box?",
        answer: (
          <>
            Before any signature is actually submitted to EPA, ManifestMate shows you the exact
            certification language you&apos;re agreeing to for that specific role — for
            generators, this is EPA&apos;s own official certification text from the manifest form.
            You have to actively check a box confirming you&apos;ve read and agree before the
            signature can go through. This exists specifically to prevent accidental signatures —
            for example, someone meaning to sign as the generator but clicking the wrong button —
            since once a signature reaches EPA, it can&apos;t be undone.
          </>
        ),
      },
      {
        question: "How does ManifestMate prove who actually signed a manifest, and when?",
        answer: (
          <>
            Every signing attempt — successful or not — is recorded in an independent audit entry,
            capturing the exact certification language shown, the printed name entered, a
            timestamp, and technical details including the IP address and device used. This is
            kept in addition to EPA&apos;s own official signature record, giving you independently
            verifiable proof of who authorized each signature and when — including in situations
            where EPA&apos;s own record alone can&apos;t tell the full story (see the next
            question).
          </>
        ),
      },
      {
        question: "If my company shares login credentials among employees, does EPA’s record show which employee actually signed?",
        answer: (
          <>
            No — this is a nuance of how EPA&apos;s own system works, not a ManifestMate
            limitation. EPA&apos;s electronic signature system records whichever account&apos;s
            credentials were used, not necessarily the specific individual who clicked the button.
            If your company shares one set of credentials, EPA&apos;s record will show your
            company&apos;s registered account holder, not the individual employee.
            ManifestMate&apos;s own internal audit trail is what actually tracks which specific
            person triggered a given signature — which is exactly why it exists.
          </>
        ),
      },
      {
        question: "Is a signature made through ManifestMate legally the same as signing the paper form?",
        answer: (
          <>
            Yes, for the generator&apos;s, transporter&apos;s, and receiving facility&apos;s
            <em> initial</em> signatures — ManifestMate uses EPA&apos;s official &quot;Quick
            Sign&quot; electronic signature method, which EPA has confirmed is legally equivalent
            to signing the paper manifest for those steps. The one exception: the disposal
            facility&apos;s <em>final</em> certification submitted to EPA requires EPA&apos;s more
            rigorous identity-verification process, separate from everyday manifest signing.
          </>
        ),
      },
    ],
  },
  {
    id: "chain-of-custody",
    title: "Chain of custody & transporters",
    entries: [
      {
        question: "In what order do people need to sign a manifest?",
        answer: (
          <>
            The generator signs first. Then each transporter who takes custody of the shipment
            signs to acknowledge receipt. Finally, the disposal facility signs last, once the
            waste arrives. EPA&apos;s system enforces this overall sequence — for example, the
            disposal facility can&apos;t sign before a transporter has.
          </>
        ),
      },
      {
        question: "If waste is transferred from one truck to another, does that always require a new signature?",
        answer: (
          <>
            Only if custody actually changes to a <em>different</em> transportation company. If
            the same company simply moves your shipment from one of their own trucks to another —
            for example, consolidating smaller loads into a full truckload — no new signature is
            needed. A new signature is only required when the waste is handed off to a genuinely
            different transporter. This is directly how EPA defines chain of custody for
            hazardous waste shipments.
          </>
        ),
      },
      {
        question: "What happens if the disposal facility rejects some or all of my waste shipment?",
        answer: (
          <>
            The original manifest isn&apos;t left open or reopened. The facility notes the
            rejection on that manifest, and the redirected or returned waste has to be tracked on
            a <strong>new</strong> manifest that references the original tracking number. You can
            do this today in ManifestMate by creating a new manifest and noting the original
            tracking number in that manifest&apos;s special instructions — there isn&apos;t yet a
            dedicated guided workflow for this, but the underlying process works.
          </>
        ),
      },
    ],
  },
  {
    id: "tracking",
    title: "Tracking manifests & documents",
    entries: [
      {
        question: "Where can I see all my company’s manifests in one place?",
        answer: (
          <>
            Your Dashboard lists every manifest you&apos;ve created or signed through
            ManifestMate, with its current status and a quick view of who has signed so far.
          </>
        ),
      },
      {
        question: "How do I know who has signed a manifest, and when?",
        answer: (
          <>
            Every manifest&apos;s detail page shows a signature checklist — a checkmark next to
            each party (generator, each transporter, disposal facility) along with the
            signer&apos;s name and the date they signed.
          </>
        ),
      },
      {
        question: "Where can I get a copy of the completed manifest for my records?",
        answer: (
          <>
            Once a manifest is signed, ManifestMate automatically stores the official documents
            EPA generates — the completed manifest PDF and per-signer records — in your account,
            so you can view or download them anytime without needing to go back to EPA&apos;s own
            system.
          </>
        ),
      },
    ],
  },
  {
    id: "data-security",
    title: "Data security",
    entries: [
      {
        question: "How are my EPA API credentials stored?",
        answer: (
          <>
            Encrypted at rest, and never displayed back to anyone — including you — after you
            save them. If you need to change them, you enter new ones; the old ones are simply
            overwritten, never shown again.
          </>
        ),
      },
      {
        question: "Who can see my company’s manifest data?",
        answer: (
          <>
            Only your own account. Access is enforced at the database level for every user,
            meaning your manifests, documents, and signature records aren&apos;t reachable by any
            other company&apos;s account under any normal use of the application.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Frequently asked questions
            </h1>
            <p className="mt-6 text-lg text-gray-700">
              Everything about getting set up, creating and signing manifests, chain of custody,
              and how ManifestMate keeps your data secure.
            </p>
          </div>

          <nav className="mt-10 mx-auto max-w-3xl flex flex-wrap justify-center gap-3">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-blue shadow-sm hover:bg-brand-blue hover:text-white transition"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-16">
            {sections.map((section) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-brand-navy border-b border-gray-200 pb-3">
                  {section.title}
                </h2>
                <div className="mt-6 space-y-6">
                  {section.entries.map((entry) => (
                    <div
                      key={entry.question}
                      className="rounded-xl bg-white p-6 shadow-sm border border-transparent"
                    >
                      <h3 className="font-semibold text-brand-navy text-lg">{entry.question}</h3>
                      <p className="mt-2 text-gray-700 leading-relaxed">{entry.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:pb-24 bg-brand-tint">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-brand-navy">Still have questions?</h2>
            <p className="mt-3 text-gray-600">
              Jump into ManifestMate and try it out, or head to Settings to connect your EPA
              credentials.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/manifests/new"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 bg-gradient-to-r from-brand-blue to-brand-green"
              >
                Create a manifest →
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border-2 border-brand-blue text-brand-blue transition hover:bg-brand-tint"
              >
                Back to home
              </Link>
            </div>
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
