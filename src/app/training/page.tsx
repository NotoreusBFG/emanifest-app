import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manifest Signer Training (Draft) — ManifestMate",
  description:
    "Draft DOT hazmat employee training course (49 CFR 172.704) for anyone who signs a hazardous waste manifest.",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-brand-navy pt-4">{children}</h2>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-brand-navy">{children}</h3>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">{children}</div>;
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <li>
      <p className="font-semibold text-gray-900">{q}</p>
      <p className="text-green-700">{a}</p>
    </li>
  );
}

export default function TrainingDraftPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl">
            <Link href="/dashboard" className="text-sm font-medium text-brand-blue hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Manifest Signer Training
            </h1>
            <p className="mt-6 text-lg text-gray-700">
              A DOT hazmat employee training course (49 CFR 172.704) for anyone who signs a
              hazardous waste manifest — scoped to General Awareness, Function-Specific, and
              Security Awareness training.
            </p>
          </div>
        </section>

        <section className="px-6 pt-10 sm:px-12">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">Draft — internal review only.</p>
              <p className="mt-1">
                This course content has not had legal review and is not yet a certified,
                completable training product. Nothing on this page currently issues a real
                completion certificate. Content, scope, and disclaimer language are all subject
                to change before this becomes a live subscriber feature.
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:py-20">
          <article className="mx-auto max-w-3xl space-y-6 text-gray-800 leading-relaxed">
            <SectionHeading>Why this course exists</SectionHeading>
            <p>
              Anyone who signs Item 15/16/20 of the manifest is, by DOT&apos;s definition, a
              &quot;hazmat employee&quot; (49 CFR 171.8) because signing certifies a shipping
              paper under 172.204/172.205. That triggers 49 CFR 172.704 training — separate from,
              and in addition to, any EPA/RCRA generator training under 40 CFR 262.17.
            </p>
            <p>
              This course covers three of the five 172.704 components: <strong>general
              awareness</strong>, <strong>function-specific</strong>, and <strong>security
              awareness</strong>. It does <strong>not</strong> cover <strong>safety
              training</strong> (must reflect the employer&apos;s actual materials and
              site-specific emergency response — a canned course can&apos;t do that) or{" "}
              <strong>in-depth security training</strong> (only required if the employer has a
              DOT security plan under 172.802, which most generators don&apos;t).
            </p>

            <SectionHeading>Module 1 — General Awareness / Familiarization</SectionHeading>
            <p className="text-sm text-gray-500">~10-12 min · satisfies 172.704(a)(1)</p>

            <SubHeading>1.1 What the manifest system is for</SubHeading>
            <p>
              The Uniform Hazardous Waste Manifest (EPA Form 8700-22) is the chain-of-custody
              document that tracks hazardous waste from the generator, through each transporter,
              to the final designated facility. It exists because RCRA requires &quot;cradle to
              grave&quot; accountability — EPA and the states need to be able to prove a given
              load of waste actually arrived where it was supposed to.
            </p>

            <SubHeading>1.2 Why DOT is involved at all</SubHeading>
            <p>
              The manifest is simultaneously an EPA tracking document <em>and</em> a DOT shipping
              paper. That dual role is why the person who signs it has two separate, stacking
              sets of training obligations (DOT&apos;s 172.704 and, if they&apos;re generator
              staff, EPA&apos;s 262.17) — this course only covers the DOT half.
            </p>

            <SubHeading>1.3 Recognizing what&apos;s on the manifest</SubHeading>
            <p>
              The generator/transporter/facility ID blocks, the waste line items (DOT proper
              shipping name, hazard class, ID number, packing group, quantity), and the
              certification blocks. This module isn&apos;t asking you to <em>classify</em> waste
              — that&apos;s a separate EPA competency — just to recognize the parts of the form
              and what each represents.
            </p>

            <SectionHeading>Module 2 — Function-Specific: Signing the Manifest</SectionHeading>
            <p className="text-sm text-gray-500">
              ~20-25 min · satisfies 172.704(a)(2) — the core module
            </p>

            <SubHeading>2.1 What your signature legally means</SubHeading>
            <p>Signing Item 15 is a certification, not a formality. By signing, you&apos;re personally certifying, under penalty of law, that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                The shipment is fully and accurately described by proper shipping name and
                classed, packed, marked, and labeled in accordance with DOT regulations (49 CFR
                172.204/172.205), and
              </li>
              <li>
                If the generator is a Large Quantity Generator, that a waste minimization program
                is in place per <strong>40 CFR 262.27(a)</strong>; Small Quantity Generators
                certify the lighter-weight statement at <strong>262.27(b)</strong>.
              </li>
            </ul>

            <SubHeading>2.2 Who is actually allowed to sign</SubHeading>
            <p>
              The signer must be someone authorized to bind the generator (owner, operator, or an
              authorized representative). If you&apos;re signing as a{" "}
              <Link href="/settings" className="text-brand-blue hover:underline">
                Quick-Sign delegate
              </Link>
              , you&apos;re signing on behalf of the account owner — the legal certification is
              theirs, made through you, not an independent certification of your own.
            </p>

            <SubHeading>2.3 What &quot;getting it wrong&quot; actually costs</SubHeading>
            <p>
              Knowing false statements on a document required to be maintained under RCRA can
              carry both civil penalties and criminal liability under{" "}
              <strong>42 U.S.C. §6928(d)</strong> (RCRA&apos;s criminal enforcement provision) —
              separate from routine civil penalties for late or incomplete manifests. (Current
              civil penalty dollar amounts are inflation-adjusted annually by EPA — check EPA&apos;s
              civil penalty policy for the current figure rather than relying on a number quoted
              here.)
            </p>

            <SubHeading>2.4 Common real-world signing mistakes</SubHeading>
            <ul className="list-disc pl-6 space-y-2">
              <li>Signing before waste is actually loaded/ready — the date must match the actual offer-for-transport date.</li>
              <li>
                Signing for LDR-restricted waste without the required LDR notification paperwork
                attached — see{" "}
                <Link href="/ldr" className="text-brand-blue hover:underline">
                  LDR notices
                </Link>
                .
              </li>
              <li>Delegate signing without an active, correctly-scoped Quick-Sign delegation.</li>
              <li>
                Confusing the generator certification block with the transporter or designated
                facility blocks — only complete the block that matches your actual role in the
                shipment.
              </li>
            </ul>

            <SectionHeading>Module 3 — Security Awareness</SectionHeading>
            <p className="text-sm text-gray-500">~8-10 min · satisfies 172.704(a)(4)</p>
            <p>
              172.704(c) requires &quot;an awareness of security risks associated with hazardous
              materials transportation and methods designed to enhance transportation
              security,&quot; including how to recognize and respond to possible security
              threats. In plain terms for a generator-side signer:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Don&apos;t leave a loaded/staged hazmat shipment unattended or accessible to unauthorized people before pickup.</li>
              <li>Verify the transporter/driver actually matches who was expected (company, driver ID) before releasing custody.</li>
              <li>Know who at your company to notify if something about a pickup looks wrong — wrong vehicle, wrong driver, unscheduled pickup, tampering.</li>
              <li>
                This module does <strong>not</strong> cover in-depth/company security-plan
                training (172.802) — that only applies if your company is required to have a DOT
                security plan, a quantity/hazard-class threshold most generators don&apos;t hit.
              </li>
            </ul>

            <SectionHeading>Quiz (draft — 10 questions, suggested pass threshold 80%)</SectionHeading>
            <p className="text-sm text-gray-500">
              Shown here with answers for review purposes. The live version would hide answers
              until submission.
            </p>
            <ol className="list-decimal pl-6 space-y-4">
              <QA q="What EPA form number is the Uniform Hazardous Waste Manifest?" a="8700-22" />
              <QA
                q="Signing Item 15 certifies the shipment is properly classed, packed, marked, and labeled per which DOT sections?"
                a="172.204/172.205"
              />
              <QA
                q="True/False: A Large Quantity Generator's Item 15 signature also certifies a waste minimization program under 40 CFR 262.27(a)."
                a="True"
              />
              <QA
                q="If you sign as a delegate under a Quick-Sign delegation, whose certification are you legally making?"
                a="The owner's/account holder's — not your own independent certification"
              />
              <QA
                q="What DOT regulation triggers hazmat employee training for anyone who signs the manifest?"
                a="49 CFR 172.704"
              />
              <QA q="How often must recurrent DOT hazmat employee training be completed?" a="Every 3 years" />
              <QA
                q="True/False: This course satisfies DOT's safety-training component of 172.704."
                a="False — safety training must be facility/material-specific"
              />
              <QA
                q="Before releasing a hazmat shipment to a transporter, what should you verify?"
                a="That the driver/vehicle matches who was actually expected"
              />
              <QA
                q="What federal statute carries potential criminal liability for a knowing false statement on a RCRA-required document like the manifest?"
                a="42 U.S.C. §6928(d)"
              />
              <QA
                q="True/False: In-depth security training under 172.802 applies to every generator regardless of size."
                a="False — only generators required to have a DOT security plan"
              />
            </ol>

            <SectionHeading>Completion certificate — planned fields</SectionHeading>
            <p>
              Per 172.704(d) recordkeeping, the employer — not ManifestMate — is legally
              responsible for retaining the training record (3 years plus 90 days past employment
              end, producible to DOT on request). The planned certificate would carry every field
              172.704(d) requires:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Employee (learner) name</li>
              <li>Date of completion</li>
              <li>
                Description of training content (&quot;General Awareness/Familiarization,
                Function-Specific — Manifest Signing, and Security Awareness training under 49
                CFR 172.704&quot;)
              </li>
              <li>Trainer name and address (ManifestMate&apos;s registered business name/address)</li>
              <li>
                Certification statement: &quot;This individual has completed the above-listed
                training&quot; — not &quot;this individual is DOT-compliant,&quot; since
                compliance also depends on the employer&apos;s own safety-training supplement and
                recordkeeping.
              </li>
            </ul>

            <SectionHeading>Planned disclaimer (would ship in the live UI)</SectionHeading>
            <Callout>
              <p className="text-sm">
                This course covers the General Awareness, Function-Specific, and Security
                Awareness components of DOT hazmat employee training (49 CFR 172.704) for
                manifest signers. It does not cover Safety Training, which by regulation must
                reflect your facility&apos;s specific materials and emergency response procedures
                — supplement with your own site-specific safety training. It also does not cover
                In-Depth Security Training, which only applies if your company is required to
                have a DOT security plan under 172.802. You (the employer) are responsible for
                retaining this certificate as part of your training record.
              </p>
            </Callout>

            <SectionHeading>Open questions before this ships</SectionHeading>
            <ul className="list-disc pl-6 space-y-2">
              <li>Confirm final dollar-figure-free phrasing on penalties before this goes live (re-verify against the current EPA civil penalty inflation adjustment table).</li>
              <li>Decide whether Module 2.2 (delegate signing) should link live into the Quick-Sign UI or stay purely explanatory.</li>
              <li>Legal review — this is a compliance-training product, and the certificate is a document a customer will hand to a DOT inspector.</li>
            </ul>
          </article>
        </section>
      </main>

      <footer className="px-6 py-8 sm:px-12 text-center text-sm text-gray-500 border-t border-gray-200">
        <p>Draft content for internal review — not legal advice, not yet a live product feature.</p>
      </footer>
    </div>
  );
}
