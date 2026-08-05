import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listManifestsForTransporterOwner } from "@/services/transporterDashboardRepository";
import { deriveManifestBadge } from "@/lib/manifestStatusBadge";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/**
 * View-only status tracker for a transporter company account — global
 * across every generator this company works with (matches the shared
 * `transporters` masterlist design, see 20260820_add_transporter_dashboard_rpc.sql).
 * Deliberately has no signing action here — signing stays exclusively on
 * the accountless SMS /sign/[token] driver flow.
 */
export default async function TransporterDashboardPage() {
  const supabase = await createClient();

  const mm2Enabled = await getFeatureFlag(supabase, "mm2_ui");
  if (!mm2Enabled) redirect("/dashboard");

  const manifests = await listManifestsForTransporterOwner(supabase);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-brand-navy">Manifests assigned to your company</h1>
      <p className="mt-1 text-gray-600">
        Status across every generator you work with. Drivers sign via the SMS link they receive
        directly — nothing to sign here.
      </p>

      {manifests.length === 0 ? (
        <p className="mt-8 text-gray-600">No manifests assigned yet.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {manifests.map((m) => {
            const badge = deriveManifestBadge(m.generatorSignedAt, m.transporterSignedAt, m.facilitySignedAt);
            return (
              <Card key={`${m.epaMtn}-${m.transporterEpaSiteId}`} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-navy">{m.epaMtn}</p>
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {m.generatorName ?? "—"} → {m.designatedFacilityName ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">Leg {m.transporterOrder}</p>
                  </div>
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                </div>
                <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
                  Updated {new Date(m.updatedAt).toLocaleString()}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
