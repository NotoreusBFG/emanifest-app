import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLdrNoticeById } from "@/services/ldrRepository";
import { getRcrainfoClientForUser } from "@/services/manifestService";
import type { SiteDetails } from "@/lib/rcrainfo/types";
import { LDR_MANAGEMENT_OPTIONS } from "@/lib/ldr/certificationText";
import { LDR_DISCLAIMER } from "@/lib/ldr/disclaimer";
import { brand } from "@/lib/brandColors";
import { PrintButton } from "./PrintButton";
import { AttachmentsSection } from "./AttachmentsSection";

function formatAddress(site: SiteDetails | null): string {
  const a = site?.siteAddress;
  if (!a) return "—";
  const line2 = [a.city, a.state?.code, a.zip].filter(Boolean).join(", ");
  return [a.address1, line2].filter(Boolean).join(" · ") || "—";
}

/**
 * Printable LDR notice detail (40 CFR 268.7(a)) -- the "hand this to the
 * receiving facility" document. Generator name/address isn't stored on the
 * `ldr_notices` row itself (only the EPA site ID), so it's fetched live
 * from RCRAInfo here via the user's own saved credentials -- gracefully
 * degrades to just the EPA ID if that lookup fails (e.g. not yet
 * authorized for that site), same "don't block the page on a secondary
 * lookup" pattern used elsewhere in this app.
 */
export default async function LdrNoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const notice = await getLdrNoticeById(supabase, user.id, id);
  if (!notice) notFound();

  let generatorSite: SiteDetails | null = null;
  try {
    const client = await getRcrainfoClientForUser(supabase, user.id);
    generatorSite = await client.getSiteDetails(notice.generatorEpaSiteId);
  } catch {
    // Live address lookup is a nice-to-have, not required to view the notice.
  }

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

      <p className="no-print">
        <Link href="/ldr" style={{ color: brand.blue }}>
          ← Back to LDR notices
        </Link>
      </p>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h1 style={{ color: brand.navy, margin: 0 }}>LDR Notice</h1>
        <PrintButton />
      </div>

      {notice.supersededAt && (
        <p className="no-print" style={{ background: "#f5f5f5", color: "#999", padding: "8px 12px", borderRadius: "6px", fontSize: "13px" }}>
          This notice was superseded on {new Date(notice.supersededAt).toLocaleDateString()} — a newer notice
          replaced it for this generator/facility/waste combination.
        </p>
      )}

      <div style={{ border: `1px solid ${brand.tint}`, borderRadius: "6px", padding: "24px", background: "white" }}>
        <h2 style={{ color: brand.navy, marginTop: 0, marginBottom: "20px", textAlign: "center", fontSize: "28px" }}>
          Land Disposal Restriction Notice
          <br />
          <span style={{ fontSize: "15px", fontWeight: 400, color: "#666" }}>40 CFR 268.7(a)(4)</span>
        </h2>

        <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 0", verticalAlign: "top", fontWeight: 600, width: "160px" }}>Generator</td>
              <td style={{ padding: "6px 0" }}>
                {generatorSite?.name ?? notice.generatorEpaSiteId} ({notice.generatorEpaSiteId})
                <br />
                <span style={{ color: "#666", fontSize: "13px" }}>{formatAddress(generatorSite)}</span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "6px 0", verticalAlign: "top", fontWeight: 600 }}>Receiving facility</td>
              <td style={{ padding: "6px 0" }}>
                {notice.receivingFacilityName} ({notice.receivingFacilityEpaSiteId})
              </td>
            </tr>
            {notice.epaMtn && (
              <tr>
                <td style={{ padding: "6px 0", fontWeight: 600 }}>First shipment MTN</td>
                <td style={{ padding: "6px 0" }}>{notice.epaMtn}</td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 style={{ color: brand.navy }}>Waste line{notice.wasteLines.length > 1 ? "s" : ""}</h3>
        {notice.wasteLines.map((w, i) => (
          <div key={i} style={{ borderTop: i > 0 ? "1px solid #eee" : undefined, paddingTop: i > 0 ? "10px" : 0, marginTop: i > 0 ? "10px" : 0 }}>
            {w.manifestLineNumber !== null && (
              <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#888" }}>Manifest line {w.manifestLineNumber}</p>
            )}
            <p style={{ margin: "4px 0" }}>
              <strong>EPA Hazardous Waste Number(s):</strong> {w.epaHazardousWasteNumbers.join(", ") || "—"}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>How must be managed:</strong> {LDR_MANAGEMENT_OPTIONS[w.howManaged].shortLabel}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Category:</strong> {w.wastewaterCategory === "wastewater" ? "Wastewater" : "Nonwastewater"}
              {w.subdivision ? ` — ${w.subdivision}` : ""}
            </p>
            {w.constituentsOfConcern && (
              <p style={{ margin: "4px 0" }}>
                <strong>Constituents of concern:</strong> {w.constituentsOfConcern}
              </p>
            )}
            {w.wasteAnalysisData && (
              <p style={{ margin: "4px 0" }}>
                <strong>Waste analysis data:</strong> {w.wasteAnalysisData}
              </p>
            )}
          </div>
        ))}

        {notice.certifications.length > 0 && (
          <>
            <h3 style={{ color: brand.navy }}>
              Certification{notice.certifications.length > 1 ? "s" : ""}
            </h3>
            {notice.certifications.map((cert) => (
              <div key={cert.letter} style={{ marginBottom: "14px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: brand.navy, margin: "0 0 4px" }}>{cert.heading}</p>
                <p style={{ fontSize: "13px", fontStyle: "italic", margin: "0 0 6px" }}>{cert.certificationText}</p>
                <p style={{ fontSize: "14px", margin: 0 }}>
                  <strong>Signed:</strong> {cert.signedByName} — {new Date(cert.signedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </>
        )}

        <p style={{ fontSize: "13px", color: "#666", marginTop: "22px" }}>
          Prepared by {notice.preparedByName || "—"} on {notice.preparedDate}
        </p>

        <p style={{ fontSize: "10.5px", color: "#999", marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
          {LDR_DISCLAIMER}
        </p>
      </div>

      <p className="no-print" style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>
        Retain a copy on-site for 3 years from the date this waste was last sent (40 CFR 268.7(a)(8)).
      </p>

      <AttachmentsSection ldrNoticeId={notice.id} />
    </div>
  );
}
