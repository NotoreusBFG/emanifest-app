import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listLeads, type Lead } from "@/services/leadsRepository";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS } from "@/lib/leadStatus";
import { contactPriorityRank, categoryRank } from "@/lib/leadCallPriority";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const NOT_CALLABLE = new Set(["converted", "not_interested", "do_not_contact"]);

export default async function CallSheetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const allLeads = await listLeads(supabase);
  const callable = allLeads.filter((lead) => !NOT_CALLABLE.has(lead.status));

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

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
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

      <div className="mt-8 flex flex-col gap-10">
        {categories.map((category) => {
          const leads = byCategory.get(category)!;
          return (
            <section key={category}>
              <h2 className="text-lg font-bold text-brand-navy">
                {category} <span className="font-normal text-gray-400">({leads.length})</span>
              </h2>
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
