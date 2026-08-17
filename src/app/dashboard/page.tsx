import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decryptMmin, listManifestIdsWithDocuments, listManifestsForUser } from "@/services/manifestRepository";
import { listActiveLdrNoticesByMtn } from "@/services/ldrRepository";
import { listDriverSignInfoByMtn } from "@/services/driverSignRepository";
import { getOnboardingProgress } from "@/services/onboardingRepository";
import { brand } from "@/lib/brandColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SendForSignature } from "@/components/SendForSignature";
import { AccountStatusCard } from "@/components/AccountStatusCard";
import { deriveManifestBadge } from "@/lib/manifestStatusBadge";
import { formatElapsedHours, getTransporterTimingInfo, TRANSPORTER_TIMING_COLOR } from "@/lib/transporterTiming";

/**
 * Reads from the local `manifests` mirror table rather than RCRAInfo's API
 * — no live per-row API calls needed to render a list, unlike the lookup
 * page which always fetches fresh from EPA for full detail. Data here can
 * lag slightly behind EPA's actual current status until the next time a
 * given manifest is looked up or signed (see `recordManifestLocally` in
 * manifestRepository.ts for how the mirror gets refreshed).
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const manifests = user ? await listManifestsForUser(supabase, user.id) : [];

  // Both batched (one query each, not one per row) so the dashboard stays
  // fast and local-only regardless of list length -- see each function's
  // own comment for why.
  const manifestIdsWithDocuments = user
    ? await listManifestIdsWithDocuments(supabase, manifests.map((m) => m.id))
    : new Set<string>();
  const ldrNoticesByMtn = user
    ? await listActiveLdrNoticesByMtn(supabase, user.id, manifests.map((m) => m.epa_mtn))
    : {};
  const driverSignInfoByMtn = user
    ? await listDriverSignInfoByMtn(supabase, manifests.map((m) => m.epa_mtn))
    : {};
  const onboardingProgress = user ? await getOnboardingProgress(supabase, user.id) : null;

  const receivedCount = manifests.filter(
    (m) => deriveManifestBadge(m.generator_signed_at, m.transporter_signed_at, m.facility_signed_at)?.variant === "received"
  ).length;
  const overdueCount = manifests.filter(
    (m) => deriveManifestBadge(m.generator_signed_at, m.transporter_signed_at, m.facility_signed_at)?.variant === "overdue"
  ).length;
  const activeCount = manifests.length - receivedCount;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      {user && onboardingProgress && (
        <div className="mb-6">
          <AccountStatusCard email={user.email ?? ""} progress={onboardingProgress} />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Your manifests</h1>
          <p className="mt-1 text-gray-600">
            Every manifest you&apos;ve saved or signed through ManifestMate, in one place.
          </p>
          {manifests.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {activeCount} active{overdueCount > 0 ? `, ${overdueCount} overdue` : ""}
            </p>
          )}
        </div>
        <Button href="/manifests/new">+ New manifest</Button>
      </div>

      {manifests.length === 0 ? (
        <p className="mt-8 text-gray-600">
          No manifests yet —{" "}
          <Link href="/manifests/new" className="text-brand-blue hover:underline">
            create your first one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {manifests.map((m) => {
            const badge = deriveManifestBadge(
              m.generator_signed_at,
              m.transporter_signed_at,
              m.facility_signed_at
            );
            const ldrNotice = ldrNoticesByMtn[m.epa_mtn];
            const driverInfo = driverSignInfoByMtn[m.epa_mtn];
            const mmin = decryptMmin(m.mmin_encrypted);

            return (
              <Card key={m.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/manifests?mtn=${encodeURIComponent(m.epa_mtn)}`}
                      className="font-bold text-brand-blue hover:underline"
                    >
                      {m.epa_mtn}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {m.generator_name ?? "—"} → {m.designated_facility_name ?? "—"}
                    </p>
                    {m.transporter_names && (
                      <p className="truncate text-xs text-gray-400">via {m.transporter_names}</p>
                    )}
                    {mmin && (
                      <p className="truncate text-xs font-semibold text-gray-500">🔑 MMIN: {mmin}</p>
                    )}
                    {driverInfo && (
                      <p className="truncate text-xs text-gray-400">
                        🚚 {driverInfo.driverName}
                        {driverInfo.driverIdNumber && ` · ID ${driverInfo.driverIdNumber}`}
                        {driverInfo.truckNumber && ` · Truck ${driverInfo.truckNumber}`}
                        {" · "}
                        {new Date(driverInfo.signedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    <SignatureDots
                      generatorSignedAt={m.generator_signed_at}
                      transporterSignedAt={m.transporter_signed_at}
                      facilitySignedAt={m.facility_signed_at}
                    />
                    <div className="flex flex-col items-center gap-1.5">
                      {manifestIdsWithDocuments.has(m.id) && (
                        <Link
                          href={`/api/manifests/${encodeURIComponent(m.epa_mtn)}/attachments`}
                          title="View/print the signed manifest"
                          aria-label="View/print the signed manifest"
                          className="flex h-7 w-7 items-center justify-center rounded-full border text-sm"
                          style={{ borderColor: brand.blue }}
                        >
                          🖨️
                        </Link>
                      )}
                      {ldrNotice && (
                        <Link
                          href={`/ldr/${ldrNotice.id}`}
                          title="LDR notice on file — do not land dispose without required treatment"
                          aria-label="LDR notice on file"
                        >
                          <Image
                            src="/no-trash.jpeg"
                            alt="LDR notice on file"
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full object-contain"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <TransporterElapsed
                      transporterSignedAt={m.transporter_signed_at}
                      facilitySignedAt={m.facility_signed_at}
                    />
                    {ldrNotice ? (
                      <Link
                        href={`/ldr/${ldrNotice.id}`}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: brand.green }}
                      >
                        📋 LDR notice on file
                      </Link>
                    ) : (
                      <Link
                        href={`/ldr/new?mtn=${encodeURIComponent(m.epa_mtn)}`}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: brand.blue }}
                      >
                        + Create LDR notice
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Updated {new Date(m.updated_at).toLocaleString()}</span>
                    <SendForSignature mtn={m.epa_mtn} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact G/T/F checkmarks for the dashboard's overview cards — the full
 * checkmark-plus-name-plus-date version lives on the lookup page
 * (SignatureChecklistItem in manifests/page.tsx). Reads from the local
 * mirror's generator_signed_at/transporter_signed_at/facility_signed_at
 * columns rather than live EPA data, so it can lag slightly behind until
 * the manifest is next looked up or signed (recordManifestLocally is what
 * refreshes these). Kept alongside the new derived status Badge rather
 * than replaced by it (MM1.1 handoff) — it's the clearest per-handler
 * detail.
 */
function SignatureDots({
  generatorSignedAt,
  transporterSignedAt,
  facilitySignedAt,
}: {
  generatorSignedAt: string | null;
  transporterSignedAt: string | null;
  facilitySignedAt: string | null;
}) {
  const roles: Array<{ label: string; signedAt: string | null }> = [
    { label: "G", signedAt: generatorSignedAt },
    { label: "T", signedAt: transporterSignedAt },
    { label: "F", signedAt: facilitySignedAt },
  ];

  return (
    <span className="inline-flex gap-1.5">
      {roles.map((role) => (
        <span
          key={role.label}
          title={role.signedAt ? `Signed ${new Date(role.signedAt).toLocaleString()}` : "Not signed yet"}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
          style={{
            color: role.signedAt ? "white" : "#999",
            backgroundColor: role.signedAt ? brand.green : "#eee",
          }}
        >
          {role.label}
        </span>
      ))}
    </span>
  );
}

/**
 * Simple first slice of the deferred "72-hour relay timing" feature (see
 * private-notes/NEXT_SESSION.md item 6) -- just surfaces elapsed time since
 * the last transporter signed, color-cued against a rough 48h/72h scale.
 * Renders nothing until a transporter has actually signed.
 */
function TransporterElapsed({
  transporterSignedAt,
  facilitySignedAt,
}: {
  transporterSignedAt: string | null;
  facilitySignedAt: string | null;
}) {
  const info = getTransporterTimingInfo(transporterSignedAt, facilitySignedAt);
  if (!info) return <span />;

  return (
    <div
      className="text-xs"
      style={{ color: TRANSPORTER_TIMING_COLOR[info.severity] }}
      title={
        info.delivered
          ? "Time between the last transporter signature and the facility's signature"
          : "Time since the last transporter signature -- still in transit"
      }
    >
      {info.delivered ? "Delivered after " : ""}
      {formatElapsedHours(info.hours)}
      {!info.delivered ? " in transit" : ""}
    </div>
  );
}
