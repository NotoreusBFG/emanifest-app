import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listLdrNoticesForUser } from "@/services/ldrRepository";
import { brand, brandGradient } from "@/lib/brandColors";

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
    <div style={{ maxWidth: "900px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "10px" }}>
        <h1 style={{ color: brand.navy }}>LDR notices</h1>
        <Link
          href="/ldr/new"
          style={{
            background: brandGradient,
            color: "white",
            padding: "8px 14px",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          + File a new notice
        </Link>
      </div>
      <p style={{ color: "#666" }}>
        Land Disposal Restriction notices (40 CFR 268.7) — a one-time notice per generator, waste
        stream, and receiving facility combination, not a per-shipment form. EPA&apos;s e-Manifest
        system doesn&apos;t handle these at all, so ManifestMate tracks them separately.{" "}
        <Link href="/university/land-disposal-restrictions" style={{ color: brand.blue }}>
          Learn more in Haz Waste University →
        </Link>
      </p>

      {notices.length === 0 ? (
        <p style={{ color: "#666" }}>No LDR notices on file yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${brand.tint}`, textAlign: "left" }}>
              <th style={{ padding: "8px" }}>Generator</th>
              <th style={{ padding: "8px" }}>Receiving facility</th>
              <th style={{ padding: "8px" }}>Waste codes</th>
              <th style={{ padding: "8px" }}>Letters</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Prepared</th>
            </tr>
          </thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>
                  <Link href={`/ldr/${n.id}`} style={{ color: brand.blue }}>
                    {n.generatorEpaSiteId}
                  </Link>
                </td>
                <td style={{ padding: "8px" }}>
                  {n.receivingFacilityName} ({n.receivingFacilityEpaSiteId})
                </td>
                <td style={{ padding: "8px" }}>{n.wasteCodeKey || "—"}</td>
                <td style={{ padding: "8px" }}>
                  {Array.from(new Set(n.wasteLines.map((w) => w.howManaged))).sort().join(", ") || "—"}
                </td>
                <td style={{ padding: "8px" }}>
                  {n.supersededAt ? (
                    <span style={{ color: "#999" }}>Superseded</span>
                  ) : (
                    <span style={{ color: brand.green, fontWeight: 600 }}>Active</span>
                  )}
                </td>
                <td style={{ padding: "8px", color: "#666", fontSize: "13px" }}>{n.preparedDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
