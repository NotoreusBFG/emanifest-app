import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 bg-gradient-to-r from-brand-blue to-brand-green";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold border-2 border-brand-blue text-brand-blue transition hover:bg-brand-tint";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 sm:px-12">
        <Image
          src="/manifestmate-logo.jpg"
          alt="ManifestMate"
          width={220}
          height={61}
          priority
        />
        {user ? (
          <Link href="/manifests" className="font-medium text-brand-blue hover:underline">
            Go to your manifests →
          </Link>
        ) : (
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Sign in
          </Link>
        )}
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 py-16 sm:px-12 sm:py-24 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-teal">
              For generators new to hazardous waste manifesting
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">
              Hazardous waste manifests, simplified.
            </h1>
            <p className="mt-6 text-lg text-gray-700">
              Create, sign, and track EPA e-Manifests without the paperwork headache — and if
              you&apos;re just getting started, we&apos;ll walk you through EPA registration too.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/manifests/new" className={primaryButton}>
                Create a manifest →
              </Link>
              <Link href="/manifests" className={secondaryButton}>
                Look up a manifest
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              New here?{" "}
              <a href="#getting-started" className="text-brand-blue hover:underline">
                See how to get set up ↓
              </a>
            </p>
          </div>
        </section>

        {/* Getting started guide */}
        <section id="getting-started" className="px-6 py-16 sm:px-12 sm:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-brand-navy text-center">
              New to manifesting? Start here.
            </h2>
            <p className="mt-3 text-center text-gray-600 max-w-2xl mx-auto">
              These first steps happen on EPA&apos;s and your state&apos;s own systems — we can&apos;t
              do them for you, but here&apos;s exactly what to expect.
            </p>

            <ol className="mt-12 space-y-8">
              <GuideStep number={1} title="Get your EPA ID Number">
                <p>
                  Every hazardous waste generator needs an EPA ID before doing anything else.
                  It&apos;s issued by your state (or by EPA directly, in states EPA administers
                  the program) after you file the Site Identification Form (EPA Form 8700-12).
                </p>
                <a
                  href="https://www.epa.gov/hwgenerators/instructions-and-form-hazardous-waste-generators-transporters-and-treatment-storage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block font-medium text-brand-blue hover:underline"
                >
                  See EPA&apos;s instructions and form →
                </a>
              </GuideStep>

              <GuideStep number={2} title="Register with RCRAInfo &amp; get your API key">
                <p>
                  Once you have an EPA ID, create an account in EPA&apos;s RCRAInfo system. In
                  many states this same registration (the myRCRAid module) also enrolls your
                  site for e-Manifest. Expect an identity-verification step — have your legal
                  name and ID details ready. Once you&apos;re in, generate an API ID and Key
                  under <em>Tools → API</em>.
                </p>
                <a
                  href="https://rcrainfo.epa.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block font-medium text-brand-blue hover:underline"
                >
                  Go to RCRAInfo →
                </a>
              </GuideStep>

              <GuideStep number={3} title="Connect your credentials to ManifestMate">
                <p>
                  Add your RCRAInfo API ID and Key in Settings — encrypted at rest, and used only
                  to act on your behalf when you create, sign, or look up manifests.
                </p>
                <Link
                  href="/settings"
                  className="mt-3 inline-block font-medium text-brand-blue hover:underline"
                >
                  Go to Settings →
                </Link>
              </GuideStep>
            </ol>
          </div>
        </section>

        {/* Already set up */}
        <section className="px-6 py-16 sm:px-12 sm:py-24 bg-brand-tint">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-brand-navy">Already set up?</h2>
            <p className="mt-3 text-gray-600">Jump straight into the two things you came for.</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <ToolCard
                href="/manifests/new"
                title="Create a manifest"
                description="Build and save a new e-Manifest — generator, transporter, and waste line details, submitted straight to RCRAInfo."
              />
              <ToolCard
                href="/manifests"
                title="Look up a manifest"
                description="Check a manifest's status, view its handlers and waste lines, and download the official EPA-generated PDF."
              />
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

function GuideStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-5">
      <div className="flex-none flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-blue to-brand-green font-bold text-white">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-brand-navy text-lg">{title}</h3>
        <div className="mt-1 text-gray-700">{children}</div>
      </div>
    </li>
  );
}

function ToolCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border-2 border-transparent bg-white p-6 text-left shadow-sm transition hover:border-brand-blue hover:shadow-md"
    >
      <h3 className="font-semibold text-brand-navy text-lg">{title} →</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </Link>
  );
}
