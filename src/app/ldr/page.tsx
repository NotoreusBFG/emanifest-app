import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listLdrNoticesForUser } from "@/services/ldrRepository";
import { brand } from "@/lib/brandColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Land Disposal Restriction notices (40 CFR 268.7(a)) -- see
 * "ldr schema.md" at the repo root. Entirely separate from EPA's
 * e-Manifest system (confirmed out of scope there), so this list reads
 * only from ManifestMate's own `ldr_notices` table, never RCRAInfo.
 */
export default async function LdrNoticesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const notices = user ? await listLdrNoticesForUser(supabase, user.id) : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">LDR notices</h1>
        <Button href="/ldr/new">+ File a new notice</Button>
      </div>
      <p className="mt-1 text-gray-600">
        Land Disposal Restriction notices (40 CFR 268.7) — a one-time notice per generator, waste
        stream, and receiving facility combination, not a per-shipment form. EPA&apos;s e-Manifest
        system doesn&apos;t handle these at all, so ManifestMate tracks them separately.{" "}
        <Link href="/university/land-disposal-restrictions" className="text-brand-blue hover:underline">
          Learn more in Haz Waste University →
        </Link>
      </p>

      {notices.length === 0 ? (
        <p className="mt-8 text-gray-600">No LDR notices on file yet.</p>
      ) : (
        <Card className="mt-8 overflow-x-auto p-2">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="p-3 font-medium">Generator</th>
                <th className="p-3 font-medium">MTN</th>
                <th className="p-3 font-medium">Receiving facility</th>
                <th className="p-3 font-medium">Waste codes</th>
                <th className="p-3 font-medium">Letters</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Prepared</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="border-b border-gray-50 last:border-0">
                  <td className="p-3">
                    <Link href={`/ldr/${n.id}`} className="text-brand-blue hover:underline">
                      {n.generatorEpaSiteId ?? "—"}
                    </Link>
                  </td>
                  <td className="p-3">
                    {n.epaMtn ? (
                      <Link
                        href={`/manifests?mtn=${encodeURIComponent(n.epaMtn)}`}
                        className="text-brand-blue hover:underline"
                      >
                        {n.epaMtn}
                      </Link>
                    ) : n.source === "third_party" ? (
                      <Link href={`/ldr/${n.id}`} className="text-amber-600 hover:underline">
                        Unattached — add MTN
                      </Link>
                    ) : (
                      <span className="text-gray-400">— (standalone)</span>
                    )}
                  </td>
                  <td className="p-3">
                    {n.source === "third_party"
                      ? n.thirdPartyName
                        ? `${n.thirdPartyName} (third-party)`
                        : "—"
                      : n.receivingFacilityName
                        ? `${n.receivingFacilityName}${n.receivingFacilityEpaSiteId ? ` (${n.receivingFacilityEpaSiteId})` : ""}`
                        : "—"}
                  </td>
                  <td className="p-3">{n.wasteCodeKey || "—"}</td>
                  <td className="p-3">
                    {n.source === "third_party"
                      ? "Third-party"
                      : Array.from(new Set(n.wasteLines.map((w) => w.howManaged))).sort().join(", ") || "—"}
                  </td>
                  <td className="p-3">
                    {n.supersededAt ? (
                      <span className="text-gray-400">Superseded</span>
                    ) : (
                      <span className="font-semibold" style={{ color: brand.green }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500">{n.preparedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
