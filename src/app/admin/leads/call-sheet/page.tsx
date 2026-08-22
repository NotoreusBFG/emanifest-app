import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listLeads, listLatestActivitiesForLeads, type Lead, type LeadActivity } from "@/services/leadsRepository";
import { listCallScripts } from "@/services/callScriptsRepository";
import { saveCallScriptAction } from "@/app/actions/callScriptsActions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS } from "@/lib/leadStatus";
import { contactPriorityRank, categoryRank } from "@/lib/leadCallPriority";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LeadActivityBadge } from "@/components/LeadActivityBadge";

const NOT_CALLABLE = new Set(["converted", "not_interested", "do_not_contact"]);

export default async function CallSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: selectedCategory } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const [allLeads, scripts] = await Promise.all([listLeads(supabase), listCallScripts(supabase)]);
  const callable = allLeads.filter((lead) => !NOT_CALLABLE.has(lead.status));
  const latestActivities = await listLatestActivitiesForLeads(
    supabase,
    callable.map((lead) => lead.id)
  );

  const byCategory = new Map<string, Lead[]>();
  for (const lead of callable) {
    const key = lead.category ?? "UNCATEGORIZED";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(lead);
  }

  const categories = Array.from(byCategory.keys()).sort((a, b) => categoryRank(a) - categoryRank(b));

  for (const list of byCategory.values()) {
    list.sort((a, b) => {
      const rankDiff = contactPriorityRank(a.contactName, a.contactTitle) - contactPriorityRank(b.contactName, b.contactTitle);
      if (rankDiff !== 0) return rankDiff;
      const expA = a.eManifestExperience === "novice" ? 0 : a.eManifestExperience === "experienced" ? 1 : 2;
      const expB = b.eManifestExperience === "novice" ? 0 : b.eManifestExperience === "experienced" ? 1 : 2;
      if (expA !== expB) return expA - expB;
      return a.companyName.localeCompare(b.companyName);
    });
  }

  const focused = selectedCategory && byCategory.has(selectedCategory) ? selectedCategory : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/admin/leads" className="text-sm text-brand-blue hover:underline">
        ← All leads
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-navy">Call sheet</h1>
      <p className="mt-1 text-gray-600">
        Every callable lead ({callable.length} of {allLeads.length}, excludes converted/not-interested/do-not-contact),
        grouped by category in calling priority order, and within each category sorted by who&apos;s the best
        decision-maker to reach (owner/president first, then director/manager, then a named contact, then no
        contact on file) — novice e-Manifest leads before experienced ones as the tiebreaker.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/leads/call-sheet"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !focused ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All categories
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            href={`/admin/leads/call-sheet?category=${encodeURIComponent(category)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              focused === category ? "bg-brand-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {category} ({byCategory.get(category)!.length})
          </Link>
        ))}
      </div>

      {focused ? (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <section>
            <h2 className="text-lg font-bold text-brand-navy">
              {focused} <span className="font-normal text-gray-400">({byCategory.get(focused)!.length})</span>
            </h2>
            <LeadList leads={byCategory.get(focused)!} latestActivities={latestActivities} />
          </section>
          <ScriptPanel category={focused} script={scripts[focused] ?? ""} />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="text-lg font-bold text-brand-navy">
                {category} <span className="font-normal text-gray-400">({byCategory.get(category)!.length})</span>
              </h2>
              <LeadList leads={byCategory.get(category)!} latestActivities={latestActivities} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadList({ leads, latestActivities }: { leads: Lead[]; latestActivities: Map<string, LeadActivity> }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {leads.map((lead) => (
        <Link key={lead.id} href={`/admin/leads/${lead.id}`}>
          <Card className="p-3 hover:shadow-[0_2px_14px_rgba(10,34,70,0.12)] transition">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-brand-navy truncate">{lead.companyName}</p>
                <p className="mt-0.5 text-sm text-gray-600 truncate">
                  {lead.contactName
                    ? `${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""}`
                    : "No contact on file"}
                  {lead.phone ? ` · ${lead.phone}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <LeadActivityBadge lead={lead} latestActivity={latestActivities.get(lead.id)} />
                {lead.eManifestExperience && (
                  <span className="text-xs text-gray-400 uppercase">{lead.eManifestExperience}</span>
                )}
                <Badge variant={LEAD_STATUS_VARIANTS[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ScriptPanel({ category, script }: { category: string; script: string }) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="p-5">
        <h3 className="font-bold text-brand-navy">Script — {category}</h3>
        <form action={saveCallScriptAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="category" value={category} />
          <textarea
            name="script"
            rows={20}
            defaultValue={script}
            placeholder="No script written for this category yet — add one here."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <button
            type="submit"
            className="self-end rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            Save script
          </button>
        </form>
      </Card>
    </aside>
  );
}
