import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listManifestsForUser } from "@/services/manifestRepository";
import { brand } from "@/lib/brandColors";

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

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ color: brand.navy }}>Your manifests</h1>
      <p style={{ color: "#666" }}>
        Every manifest you&apos;ve saved or signed through ManifestMate, in one place.
      </p>

      {manifests.length === 0 ? (
        <p style={{ color: "#666" }}>
          No manifests yet —{" "}
          <Link href="/manifests/new" style={{ color: brand.blue }}>
            create your first one
          </Link>
          .
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${brand.tint}`, textAlign: "left" }}>
              <th style={{ padding: "8px" }}>MTN</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Generator</th>
              <th style={{ padding: "8px" }}>Designated facility</th>
              <th style={{ padding: "8px" }}>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {manifests.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>
                  <Link href={`/manifests?mtn=${encodeURIComponent(m.epa_mtn)}`} style={{ color: brand.blue }}>
                    {m.epa_mtn}
                  </Link>
                </td>
                <td style={{ padding: "8px" }}>{m.epa_status ?? "—"}</td>
                <td style={{ padding: "8px" }}>{m.generator_name ?? "—"}</td>
                <td style={{ padding: "8px" }}>{m.designated_facility_name ?? "—"}</td>
                <td style={{ padding: "8px", color: "#666", fontSize: "13px" }}>
                  {new Date(m.updated_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
