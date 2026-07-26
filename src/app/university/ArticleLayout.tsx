import Link from "next/link";

export interface UniversitySource {
  label: string;
  href?: string;
}

/**
 * Shared shell for Haz Waste University articles. Content is written fresh
 * in ManifestMate's own words -- informed by real source material (state
 * agency and industry training decks, the actual published CFR text) but
 * not reproduced verbatim, since those decks are someone else's authored
 * presentation, not regulatory text. Every article cites the actual
 * regulation as its authoritative source, plus (where relevant) the
 * training material that helped shape the explanation.
 */
export function ArticleLayout({
  title,
  dek,
  children,
  sources,
}: {
  title: string;
  dek: string;
  children: React.ReactNode;
  sources: UniversitySource[];
}) {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1">
        <section className="px-6 py-16 sm:px-12 sm:py-20 bg-brand-tint">
          <div className="mx-auto max-w-3xl">
            <Link href="/university" className="text-sm font-medium text-brand-blue hover:underline">
              ← Haz Waste University
            </Link>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-brand-navy leading-tight">{title}</h1>
            <p className="mt-6 text-lg text-gray-700">{dek}</p>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 sm:py-20">
          <article className="mx-auto max-w-3xl prose-like space-y-6 text-gray-800 leading-relaxed">
            {children}
          </article>
        </section>

        <section className="px-6 py-12 sm:px-12 bg-brand-tint">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sources</h2>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {sources.map((s) => (
                <li key={s.label}>
                  {s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 sm:px-12 text-center text-sm text-gray-500 border-t border-gray-200">
        <p>
          Haz Waste University is educational content, not legal advice — see ManifestMate&apos;s{" "}
          <Link href="/faq" className="text-brand-blue hover:underline">
            FAQ
          </Link>{" "}
          for product questions, or consult the actual regulation and your own counsel for compliance
          decisions.
        </p>
      </footer>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-brand-navy pt-4">{children}</h2>;
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-brand-navy">{children}</h3>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
      {children}
    </div>
  );
}
