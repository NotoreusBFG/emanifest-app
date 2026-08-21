import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listLeads, listDistinctCategories, listDistinctCounties, type Lead, type LeadStatus } from "@/services/leadsRepository";
import { LEAD_STATUS_LABELS as STATUS_LABELS, LEAD_STATUS_VARIANTS as STATUS_VARIANTS } from "@/lib/leadStatus";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; county?: string; status?: string; experience?: string; imported?: string; skipped?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const [leadsInScope, categories, counties] = await Promise.all([
    listLeads(supabase, {
      category: params.category,
      county: params.county,
      eManifestExperience: params.experience,
    }),
    listDistinctCategories(supabase),
    listDistinctCounties(supabase),
  ]);

  const statusCounts = leadsInScope.reduce(
    (acc, lead) => {
      acc[lead.status] = (acc[lead.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<LeadStatus, number>
  );

  const leads: Lead[] = params.status ? leadsInScope.filter((lead) => lead.status === params.status) : leadsInScope;

  const filterQuery = (overrides: Record<string, string | undefined>) => {
    const next = { ...params, ...overrides, imported: undefined, skipped: undefined };
    const usp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) usp.set(k, v);
    });
    const qs = usp.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Lead tracker</h1>
          <p className="mt-1 text-gray-600">
            {leads.length} lead{leads.length === 1 ? "" : "s"} matching current filters.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button href="/admin/leads/call-sheet" variant="secondary">
            Call sheet
          </Button>
          <Button href="/admin/leads/import" variant="secondary">
            Import CSV
          </Button>
        </div>
      </div>

      {params.imported && (
        <div className="mt-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Imported {params.imported} lead{params.imported === "1" ? "" : "s"}
          {params.skipped && params.skipped !== "0" ? ` (${params.skipped} skipped, missing company name)` : ""}.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <SelectNav
          label="Category"
          current={params.category}
          options={categories}
          buildHref={(v) => filterQuery({ category: v })}
        />
        <SelectNav
          label="County"
          current={params.county}
          options={counties}
          buildHref={(v) => filterQuery({ county: v })}
        />
        <SelectNav
          label="E-Manifest experience"
          current={params.experience}
          options={["novice", "experienced"]}
          buildHref={(v) => filterQuery({ experience: v })}
        />
        {(params.category || params.county || params.status || params.experience) && (
          <Link href="/admin/leads" className="self-center text-brand-blue hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
        <StatusSidebar current={params.status} counts={statusCounts} buildHref={(v) => filterQuery({ status: v })} />

        <div className="flex flex-col gap-2">
          {leads.length === 0 && (
            <Card className="p-8 text-center text-gray-500">
              No leads match these filters yet. Import a CSV to get started.
            </Card>
          )}
          {leads.map((lead) => (
            <Link key={lead.id} href={`/admin/leads/${lead.id}`}>
              <Card className="p-4 hover:shadow-[0_2px_14px_rgba(10,34,70,0.12)] transition">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-navy truncate">{lead.companyName}</p>
                    <p className="mt-0.5 text-sm text-gray-600 truncate">
                      {[lead.category, lead.city, lead.county].filter(Boolean).join(" · ") || "—"}
                      {lead.contactName ? ` · ${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {lead.eManifestExperience && (
                      <span className="text-xs text-gray-400 uppercase">{lead.eManifestExperience}</span>
                    )}
                    <Badge variant={STATUS_VARIANTS[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusSidebar({
  current,
  counts,
  buildHref,
}: {
  current?: string;
  counts: Record<LeadStatus, number>;
  buildHref: (value: string | undefined) => string;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const statuses = Object.keys(STATUS_LABELS) as LeadStatus[];

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="p-4">
        <h3 className="px-1 text-xs font-semibold uppercase text-gray-500">Status</h3>
        <nav className="mt-2 flex flex-col gap-0.5">
          <Link
            href={buildHref(undefined)}
            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium ${
              !current ? "bg-brand-navy text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span>All</span>
            <span className={current ? "" : "text-white/80"}>{total}</span>
          </Link>
          {statuses.map((status) => (
            <Link
              key={status}
              href={buildHref(status)}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium ${
                current === status ? "bg-brand-navy text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{STATUS_LABELS[status]}</span>
              <span className={current === status ? "text-white/80" : "text-gray-400"}>{counts[status] ?? 0}</span>
            </Link>
          ))}
        </nav>
      </Card>
    </aside>
  );
}

function SelectNav({
  label,
  current,
  options,
  optionLabels,
  buildHref,
}: {
  label: string;
  current?: string;
  options: string[];
  optionLabels?: Record<string, string>;
  buildHref: (value: string | undefined) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        <Link
          href={buildHref(undefined)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !current ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </Link>
        {options.map((opt) => (
          <Link
            key={opt}
            href={buildHref(opt)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              current === opt ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {optionLabels?.[opt] ?? opt}
          </Link>
        ))}
      </div>
    </div>
  );
}
