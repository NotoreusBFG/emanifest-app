import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listFeatureFlags } from "@/services/featureFlagRepository";
import { toggleFeatureFlagAction } from "@/app/actions/featureFlagActions";
import { listPendingAccounts } from "@/services/profileRepository";
import { approveAccountAction } from "@/app/actions/accountApprovalActions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  mm2_ui: {
    label: "Multi-role accounts + sidebar nav",
    description:
      "Generator/transporter account types, the transporter dashboard, and the new sidebar nav. Off means everyone sees today's single top-nav layout regardless of account type.",
  },
  generator_manifest_search: {
    label: "Search manifests by generator",
    description:
      "The \"By generator\" mode on the manifest lookup page — searches EPA's live records by generator name/EPA ID, with status/date-range filters and a printable waste-line table. Off means only the existing by-tracking-number lookup is shown.",
  },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/");
  }

  const flags = await listFeatureFlags(supabase);
  const pendingAccounts = await listPendingAccounts(supabase);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-navy">Admin</h1>
        <Button href="/admin/leads" variant="secondary">
          Lead tracker
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-brand-navy">
          Pending accounts{pendingAccounts.length > 0 ? ` (${pendingAccounts.length})` : ""}
        </h2>
        <p className="mt-1 text-gray-600">
          New generator and third-party signups wait here until approved — they can&apos;t reach the app until then.
        </p>

        {pendingAccounts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No accounts waiting on approval.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {pendingAccounts.map((account) => (
              <Card key={account.userId} className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-navy break-all">{account.email}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Signed up {new Date(account.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <form action={approveAccountAction} className="shrink-0">
                    <input type="hidden" name="userId" value={account.userId} />
                    <button
                      type="submit"
                      className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
                    >
                      Approve
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold text-brand-navy">Feature flags</h2>
        <p className="mt-1 text-gray-600">
          Toggle risky/in-progress features on or off in production, instantly — no redeploy needed.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {flags.map((flag) => {
          const meta = FLAG_LABELS[flag.key] ?? { label: flag.key, description: "" };
          return (
            <Card key={flag.key} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-brand-navy">{meta.label}</p>
                  {meta.description && <p className="mt-1 text-sm text-gray-600">{meta.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    Currently: <span className="font-semibold">{flag.enabled ? "ON" : "OFF"}</span> · last
                    changed {new Date(flag.updatedAt).toLocaleString()}
                  </p>
                </div>
                <form action={toggleFeatureFlagAction} className="shrink-0">
                  <input type="hidden" name="key" value={flag.key} />
                  <input type="hidden" name="enabled" value={(!flag.enabled).toString()} />
                  <button
                    type="submit"
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                      flag.enabled
                        ? "border-2 border-red-500 text-red-600 hover:bg-red-50"
                        : "text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
                    }`}
                  >
                    {flag.enabled ? "Turn off" : "Turn on"}
                  </button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
