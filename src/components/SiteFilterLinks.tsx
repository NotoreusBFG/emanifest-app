import Link from "next/link";
import type { SiteFilterOption } from "@/lib/siteFilterOptions";

/**
 * "Site: All / Site A / Site B" pill filter for a server-rendered combined
 * list (dashboard, LDR notices) -- plain Links with a `?site=` query param,
 * same pattern as the admin call-sheet's category pills, so filtering never
 * needs client JS. Renders nothing for a single-site (or no-site) account --
 * there's nothing to filter.
 */
export function SiteFilterLinks({
  basePath,
  sites,
  current,
}: {
  basePath: string;
  sites: SiteFilterOption[];
  current: string;
}) {
  if (sites.length <= 1) return null;

  const pillClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">Site:</span>
      <Link href={basePath} className={pillClass(!current)}>
        All sites
      </Link>
      {sites.map((s) => (
        <Link
          key={s.epaSiteId}
          href={`${basePath}?site=${encodeURIComponent(s.epaSiteId)}`}
          className={pillClass(current === s.epaSiteId)}
        >
          {s.siteName} ({s.epaSiteId})
        </Link>
      ))}
    </div>
  );
}
