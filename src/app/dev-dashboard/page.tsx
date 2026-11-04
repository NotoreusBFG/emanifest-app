import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getMyAdminRole } from "@/services/adminRepository";
import { isNonProductionEnvironment } from "@/lib/devEnvironment";
import {
  DEV_DASHBOARD_AS_OF,
  DEV_DASHBOARD_ROWS,
  STATUS_LABELS,
  type CoverageStatus,
  type DevDashboardRow,
} from "@/lib/devDashboardData";
import {
  BENCHMARKS,
  MILESTONES,
  RELEASE_NOTES,
  type BenchmarkStatus,
  type MilestoneStatus,
} from "@/lib/devDashboardTracking";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "releases", label: "Release notes" },
  { id: "milestones", label: "Milestones" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "epa", label: "EPA coverage" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MILESTONE_COLORS: Record<MilestoneStatus, { bg: string; text: string; label: string }> = {
  done: { bg: "#e3f4e8", text: "#1e6b3a", label: "Done" },
  "in-progress": { bg: "#e8eefb", text: "#2a4a8a", label: "In progress" },
  planned: { bg: "#eceff3", text: "#4a5563", label: "Planned" },
  blocked: { bg: "#fdecea", text: "#9b2c20", label: "Blocked" },
  watch: { bg: "#fff4e0", text: "#8a5200", label: "Watching" },
};
const BENCHMARK_COLORS: Record<BenchmarkStatus, { bg: string; text: string; label: string }> = {
  "on-track": { bg: "#e3f4e8", text: "#1e6b3a", label: "On track" },
  attention: { bg: "#fff4e0", text: "#8a5200", label: "Needs attention" },
  blocked: { bg: "#fdecea", text: "#9b2c20", label: "Blocked" },
  unknown: { bg: "#eceff3", text: "#4a5563", label: "Not yet measured" },
};
const ENV_COLORS = { Production: "#9b2c20", Dev: "#2a4a8a", Both: "#1e6b3a", Local: "#4a5563" } as const;

function Pill({ bg, text, children }: { bg: string; text: string; children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>
      {children}
    </span>
  );
}

export const metadata: Metadata = { title: "Dev Dashboard — ManifestMate" };
export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<CoverageStatus, { bg: string; text: string }> = {
  covered: { bg: "#e3f4e8", text: "#1e6b3a" },
  partial: { bg: "#fff4e0", text: "#8a5200" },
  gap: { bg: "#fdecea", text: "#9b2c20" },
  "n/a": { bg: "#eceff3", text: "#4a5563" },
  unassessed: { bg: "#e8eefb", text: "#2a4a8a" },
};

export default async function DevDashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "overview";
  // Not found (not "forbidden") for everyone else, so the route does not
  // advertise itself on production or to non-admins.
  if (!isNonProductionEnvironment()) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const role = (await getMyAdminRole(supabase)) ?? (isAdminEmail(user.email) ? "admin" : null);
  if (!role) notFound();

  const counts = DEV_DASHBOARD_ROWS.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Partial<Record<CoverageStatus, number>>
  );
  const categories = [...new Set(DEV_DASHBOARD_ROWS.map((r) => r.category))];
  const total = DEV_DASHBOARD_ROWS.length;
  const fullyRead = DEV_DASHBOARD_ROWS.filter((r) => r.reviewed === "Full").length;
  const openMilestones = MILESTONES.filter((m) => m.status === "planned" || m.status === "in-progress" || m.status === "blocked");

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="text-2xl font-bold text-brand-navy">Dev Dashboard</h1>
      <p className="mt-1 max-w-3xl text-gray-600">
        Release notes, milestones and benchmarks for ManifestMate development, plus how it compares with EPA&apos;s
        e-Manifest reference documents. Internal and admin-only; hidden on production.
      </p>
      <p className="mt-1 text-sm text-gray-500">As of {DEV_DASHBOARD_AS_OF}. Maintained by hand from the EPA deep dive and release work.</p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Dev Dashboard sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/dev-dashboard?tab=${t.id}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              t.id === tab ? "bg-brand-navy text-white" : "bg-white text-brand-navy shadow-sm hover:bg-brand-blue/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-brand-navy">EPA coverage</h2>
            <p className="mt-1 text-sm text-gray-600">
              {total} EPA documents tracked, {fullyRead} read in full.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {(Object.keys(STATUS_LABELS) as CoverageStatus[]).map((s) => (
                <Pill key={s} bg={STATUS_COLORS[s].bg} text={STATUS_COLORS[s].text}>
                  {STATUS_LABELS[s]}: {counts[s] ?? 0}
                </Pill>
              ))}
            </div>
            <Link href="/dev-dashboard?tab=epa" className="mt-3 inline-block text-sm font-semibold text-brand-blue hover:underline">
              Open the full table
            </Link>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-brand-navy">Open milestones</h2>
            <p className="mt-1 text-sm text-gray-600">{openMilestones.length} planned, in progress or blocked.</p>
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {openMilestones.slice(0, 6).map((m) => (
                <li key={m.title} className="flex items-start gap-2">
                  <Pill bg={MILESTONE_COLORS[m.status].bg} text={MILESTONE_COLORS[m.status].text}>
                    {MILESTONE_COLORS[m.status].label}
                  </Pill>
                  <span className="text-gray-700">{m.title}</span>
                </li>
              ))}
            </ul>
            <Link href="/dev-dashboard?tab=milestones" className="mt-3 inline-block text-sm font-semibold text-brand-blue hover:underline">
              All milestones
            </Link>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-brand-navy">Benchmarks needing attention</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {BENCHMARKS.filter((b) => b.status === "attention" || b.status === "blocked").map((b) => (
                <li key={b.name}>
                  <Pill bg={BENCHMARK_COLORS[b.status].bg} text={BENCHMARK_COLORS[b.status].text}>
                    {BENCHMARK_COLORS[b.status].label}
                  </Pill>{" "}
                  <span className="text-gray-700">
                    {b.name}: {b.current}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/dev-dashboard?tab=benchmarks" className="mt-3 inline-block text-sm font-semibold text-brand-blue hover:underline">
              All benchmarks
            </Link>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-brand-navy">Latest release</h2>
            <p className="mt-1 text-sm font-semibold text-gray-800">
              {RELEASE_NOTES[0].date} · {RELEASE_NOTES[0].title}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
              {RELEASE_NOTES[0].items.slice(0, 3).map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <Link href="/dev-dashboard?tab=releases" className="mt-3 inline-block text-sm font-semibold text-brand-blue hover:underline">
              All release notes
            </Link>
          </Card>
        </div>
      )}

      {tab === "releases" && (
        <div className="mt-6 flex flex-col gap-4">
          {RELEASE_NOTES.map((n) => (
            <Card key={`${n.date}-${n.title}`} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">{n.date}</span>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: ENV_COLORS[n.environment] }}>
                  {n.environment}
                </span>
                {n.commits && <span className="text-xs text-gray-400">{n.commits}</span>}
              </div>
              <h2 className="mt-1 font-bold text-brand-navy">{n.title}</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
                {n.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === "milestones" && (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-brand-navy text-white">
                <th className="px-4 py-3 font-semibold">Milestone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONES.map((m) => (
                <tr key={m.title} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 font-semibold text-brand-navy">{m.title}</td>
                  <td className="px-4 py-3">
                    <Pill bg={MILESTONE_COLORS[m.status].bg} text={MILESTONE_COLORS[m.status].text}>
                      {MILESTONE_COLORS[m.status].label}
                    </Pill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{m.date ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "benchmarks" && (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-brand-navy text-white">
                <th className="px-4 py-3 font-semibold">Benchmark</th>
                <th className="px-4 py-3 font-semibold">Current</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100 align-top">
                <td className="px-4 py-3 font-semibold text-brand-navy">EPA documents assessed (live count)</td>
                <td className="px-4 py-3 text-gray-700">
                  {total - (counts.unassessed ?? 0)} of {total}
                </td>
                <td className="px-4 py-3 text-gray-700">All assessed</td>
                <td className="px-4 py-3">
                  <Pill bg={BENCHMARK_COLORS[counts.unassessed ? "attention" : "on-track"].bg} text={BENCHMARK_COLORS[counts.unassessed ? "attention" : "on-track"].text}>
                    {BENCHMARK_COLORS[counts.unassessed ? "attention" : "on-track"].label}
                  </Pill>
                </td>
                <td className="px-4 py-3 text-gray-700">Computed from the EPA coverage table.</td>
              </tr>
              <tr className="border-t border-gray-100 align-top">
                <td className="px-4 py-3 font-semibold text-brand-navy">EPA documents with a gap or partial coverage (live count)</td>
                <td className="px-4 py-3 text-gray-700">
                  {(counts.gap ?? 0)} gaps, {(counts.partial ?? 0)} partial
                </td>
                <td className="px-4 py-3 text-gray-700">Falling over time</td>
                <td className="px-4 py-3">
                  <Pill bg={BENCHMARK_COLORS.attention.bg} text={BENCHMARK_COLORS.attention.text}>
                    {BENCHMARK_COLORS.attention.label}
                  </Pill>
                </td>
                <td className="px-4 py-3 text-gray-700">Some gaps (receiving facilities, exporters, PCB) are out of scope by choice.</td>
              </tr>
              {BENCHMARKS.map((b) => (
                <tr key={b.name} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 font-semibold text-brand-navy">{b.name}</td>
                  <td className="px-4 py-3 text-gray-700">{b.current}</td>
                  <td className="px-4 py-3 text-gray-700">{b.target}</td>
                  <td className="px-4 py-3">
                    <Pill bg={BENCHMARK_COLORS[b.status].bg} text={BENCHMARK_COLORS[b.status].text}>
                      {BENCHMARK_COLORS[b.status].label}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {b.note} <span className="text-xs text-gray-400">(as of {b.asOf})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "epa" && (
        <>
          <p className="mt-6 max-w-3xl text-sm text-gray-500">
            Signed-in screens were judged from code and nothing was tested against live RCRAInfo production. The row
            labelled &quot;Not yet reviewed&quot; has not been read, and rows marked &quot;Key sections&quot; or
            &quot;Most sections&quot; were read in part.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {(Object.keys(STATUS_LABELS) as CoverageStatus[]).map((s) => (
              <Pill key={s} bg={STATUS_COLORS[s].bg} text={STATUS_COLORS[s].text}>
                {STATUS_LABELS[s]}: {counts[s] ?? 0}
              </Pill>
            ))}
          </div>
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-brand-navy text-white">
                  <th className="w-[28%] px-4 py-3 font-semibold">EPA document</th>
                  <th className="w-[36%] px-4 py-3 font-semibold">ManifestMate solution (or lack of one)</th>
                  <th className="w-[36%] px-4 py-3 font-semibold">Where ManifestMate meets or exceeds EPA</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <CategoryRows key={category} category={category} rows={DEV_DASHBOARD_ROWS.filter((r) => r.category === category)} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function CategoryRows({ category, rows }: { category: string; rows: DevDashboardRow[] }) {
  return (
    <>
      <tr>
        <th colSpan={3} className="bg-brand-blue/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-navy">
          {category}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.title} className="border-t border-gray-100 align-top">
          <td className="px-4 py-3">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue hover:underline">
                {r.title}
              </a>
            ) : (
              <span className="font-semibold text-brand-navy">{r.title}</span>
            )}
            <p className="mt-1 text-xs text-gray-500">{r.detail}</p>
            <p className="mt-1 text-xs text-gray-400">Reviewed: {r.reviewed}</p>
          </td>
          <td className="px-4 py-3">
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: STATUS_COLORS[r.status].bg, color: STATUS_COLORS[r.status].text }}
            >
              {STATUS_LABELS[r.status]}
            </span>
            <p className="mt-2 text-gray-700">{r.solution}</p>
          </td>
          <td className="px-4 py-3 text-gray-700">
            {r.strengths.development || r.strengths.solutions || r.strengths.customer ? (
              <ul className="flex flex-col gap-2">
                {r.strengths.development && (
                  <li>
                    <strong className="text-brand-navy">Development:</strong> {r.strengths.development}
                  </li>
                )}
                {r.strengths.solutions && (
                  <li>
                    <strong className="text-brand-navy">Solutions:</strong> {r.strengths.solutions}
                  </li>
                )}
                {r.strengths.customer && (
                  <li>
                    <strong className="text-brand-navy">Customer-facing:</strong> {r.strengths.customer}
                  </li>
                )}
              </ul>
            ) : (
              <span className="text-gray-400">None identified</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
