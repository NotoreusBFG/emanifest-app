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
              <th style={{ padding: "8px" }}>Signatures</th>
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
                <td style={{ padding: "8px" }}>
                  <SignatureDots
                    generatorSignedAt={m.generator_signed_at}
                    transporterSignedAt={m.transporter_signed_at}
                    facilitySignedAt={m.facility_signed_at}
                  />
                </td>
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

/**
 * Compact G/T/F checkmarks for the dashboard's overview table — the full
 * checkmark-plus-name-plus-date version lives on the lookup page
 * (SignatureChecklistItem in manifests/page.tsx). Reads from the local
 * mirror's generator_signed_at/transporter_signed_at/facility_signed_at
 * columns rather than live EPA data, so it can lag slightly behind until
 * the manifest is next looked up or signed (recordManifestLocally is what
 * refreshes these).
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
    <span style={{ display: "inline-flex", gap: "6px" }}>
      {roles.map((role) => (
        <span
          key={role.label}
          title={
            role.signedAt
              ? `Signed ${new Date(role.signedAt).toLocaleString()}`
              : "Not signed yet"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 700,
            color: role.signedAt ? "white" : "#999",
            backgroundColor: role.signedAt ? "green" : "#eee",
          }}
        >
          {role.label}
        </span>
      ))}
    </span>
  );
}
