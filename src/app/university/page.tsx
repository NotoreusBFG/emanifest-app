import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Haz Waste University — ManifestMate",
  description:
    "Deeper dives into RCRA, DOT, and hazardous waste management — the regulatory background behind what ManifestMate helps you do.",
};

interface Topic {
  slug: string;
  title: string;
  description: string;
}

const topics: Topic[] = [
  {
    slug: "rcra-basics",
    title: "RCRA basics & cradle-to-grave",
    description:
      "What RCRA actually is, how the hazardous waste program got here, and why every shipment gets tracked from generation to final disposal.",
  },
  {
    slug: "manifests-and-dot",
    title: "The manifest & DOT shipping papers",
    description:
      "The Uniform Hazardous Waste Manifest does two jobs at once — a RCRA chain-of-custody record and a DOT shipping paper. What each part of the form is actually for.",
  },
  {
    slug: "waste-determination",
    title: "Waste determination & characterization",
    description:
      "Listed vs. characteristic waste, the four characteristics, and why getting the waste codes right at the point of generation makes every later step easier.",
  },
  {
    slug: "land-disposal-restrictions",
    title: "Land Disposal Restrictions (LDR)",
    description:
      "A manifest tracks where waste goes; LDR governs whether it's actually safe to put in the ground. The treatment standards, the notice, and how ManifestMate's LDR tool encodes them.",
  },
];

export default function UniversityIndexPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">Haz Waste University</h1>
            <p className="mt-6 text-lg text-gray-700">
              ManifestMate helps you create, sign, and track manifests — this is the regulatory
              background behind why those steps exist, so the tool makes more sense and you&apos;re
              better equipped when something doesn&apos;t fit the common case.
            </p>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:py-20">
          <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-2">
            {topics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/university/${topic.slug}`}
                className="block rounded-xl bg-white p-6 shadow-sm border border-transparent hover:border-brand-blue transition"
              >
                <h2 className="font-semibold text-brand-navy text-lg">{topic.title}</h2>
                <p className="mt-2 text-gray-600 text-sm leading-relaxed">{topic.description}</p>
                <span className="mt-3 inline-block text-sm font-medium text-brand-blue">Read more →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 sm:px-12 text-center text-sm text-gray-500 border-t border-gray-200">
        <p>
          Haz Waste University is educational content, not legal advice — see the{" "}
          <Link href="/faq" className="text-brand-blue hover:underline">
            FAQ
          </Link>{" "}
          for product questions.
        </p>
      </footer>
    </div>
  );
}
