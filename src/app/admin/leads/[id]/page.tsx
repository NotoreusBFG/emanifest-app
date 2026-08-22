import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { getLead, listActivitiesForLead, type LeadStatus } from "@/services/leadsRepository";
import { updateLeadStatusAction, addLeadActivityAction } from "@/app/actions/leadsActions";
import { LEAD_STATUS_LABELS as STATUS_LABELS, LEAD_STATUS_VARIANTS as STATUS_VARIANTS } from "@/lib/leadStatus";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const ACTIVITY_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  visit: "Visit",
  meeting: "Meeting",
  note: "Note",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const lead = await getLead(supabase, id);
  if (!lead) notFound();

  const activities = await listActivitiesForLead(supabase, id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/admin/leads" className="text-sm text-brand-blue hover:underline">
        ← All leads
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{lead.companyName}</h1>
          <p className="mt-1 text-gray-600">
            {[lead.category, lead.generatorStatus, lead.city, lead.county].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-bold text-brand-navy">Contact</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Name" value={lead.contactName} />
          <Field label="Title" value={lead.contactTitle} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Email" value={lead.email} />
          <Field label="EPA Handler ID" value={lead.epaHandlerId} />
          <Field label="E-Manifest experience" value={lead.eManifestExperience} />
          <Field label="Manifests since 2023" value={lead.manifestCount != null ? String(lead.manifestCount) : null} />
          <Field label="Region" value={lead.region} />
        </dl>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-bold text-brand-navy">Status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((status) => (
            <form key={status} action={updateLeadStatusAction}>
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  lead.status === status
                    ? "bg-brand-navy text-white"
                    : "border border-gray-300 text-gray-600 hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-bold text-brand-navy">Log an activity</h2>
        <form action={addLeadActivityAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="leadId" value={lead.id} />
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-brand-navy">Type</span>
              <select
                name="type"
                required
                defaultValue="call"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="visit">Visit</option>
                <option value="meeting">Meeting</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-brand-navy">Follow-up scheduled for (optional)</span>
              <input
                type="datetime-local"
                name="scheduledAt"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </label>
          </div>
          <input
            type="text"
            name="subject"
            placeholder='Subject (e.g. "Left voicemail", "Sent intro email")'
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <textarea
            name="notes"
            rows={3}
            placeholder="Notes / outcome"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="markCompleted" value="true" defaultChecked />
              This already happened (log as completed, not scheduled)
            </label>
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      </Card>

      <div className="mt-6">
        <h2 className="font-bold text-brand-navy">Activity history</h2>
        <div className="mt-3 flex flex-col gap-2">
          {activities.length === 0 && <p className="text-sm text-gray-500">No activity logged yet.</p>}
          {activities.map((activity) => (
            <Card key={activity.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase text-brand-blue">
                  {ACTIVITY_LABELS[activity.type] ?? activity.type}
                </span>
                <span className="text-xs text-gray-400">
                  {activity.status === "closed" && activity.completedAt
                    ? new Date(activity.completedAt).toLocaleString()
                    : activity.scheduledAt
                      ? `Scheduled ${new Date(activity.scheduledAt).toLocaleString()}`
                      : new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
              {activity.subject && <p className="mt-1 text-sm font-medium text-brand-navy">{activity.subject}</p>}
              {activity.notes && <p className="mt-1 text-sm text-gray-600">{activity.notes}</p>}
              {activity.status === "open" && (
                <span className="mt-2 inline-block text-xs font-semibold text-amber-600">Open / follow-up due</span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-brand-navy">{value || "—"}</dd>
    </div>
  );
}
