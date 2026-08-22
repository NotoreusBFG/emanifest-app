import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listLeads, listDistinctCategories, listDistinctCounties } from "@/services/leadsRepository";
import { LEAD_STATUS_LABELS as STATUS_LABELS } from "@/lib/leadStatus";
import { Card } from "@/components/ui/Card";
import { CampaignComposer } from "@/components/CampaignComposer";

export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; county?: string; status?: string; experience?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const [allLeads, categories, counties] = await Promise.all([
    listLeads(supabase, {
      category: params.category,
      county: params.county,
      status: params.status,
      eManifestExperience: params.experience,
    }),
    listDistinctCategories(supabase),
    listDistinctCounties(supabase),
  ]);

  // Campaign targeting only ever shows leads it could actually email --
  // no email on file or already unsubscribed leads are excluded here
  // rather than shown-but-disabled, since there's nothing to do with them
  // on this page. listLeads() already excludes removed leads by default.
  const leads = allLeads.filter((lead) => lead.email && !lead.emailUnsubscribedAt);

  const filterQuery = (overrides: Record<string, string | undefined>) => {
    const next = { ...params, ...overrides };
    const usp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v) usp.set(k, v);
    });
    const qs = usp.toString();
    return qs ? `/admin/leads/campaign?${qs}` : "/admin/leads/campaign";
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/admin/leads" className="text-sm text-brand-blue hover:underline">
        ← All leads
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Email campaign</h1>
          <p className="mt-1 text-gray-600">
            {leads.length} lead{leads.length === 1 ? "" : "s"} with an email on file, matching current filters.
          </p>
        </div>
      </div>

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
          label="Status"
          current={params.status}
          options={Object.keys(STATUS_LABELS)}
          optionLabels={STATUS_LABELS}
          buildHref={(v) => filterQuery({ status: v })}
        />
        <SelectNav
          label="E-Manifest experience"
          current={params.experience}
          options={["novice", "experienced"]}
          buildHref={(v) => filterQuery({ experience: v })}
        />
        {(params.category || params.county || params.status || params.experience) && (
          <Link href="/admin/leads/campaign" className="self-center text-brand-blue hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      <div className="mt-6">
        {leads.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No leads with an email on file match these filters.
          </Card>
        ) : (
          <CampaignComposer leads={leads} />
        )}
      </div>
    </div>
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
