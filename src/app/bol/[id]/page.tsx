import Link from "next/link";
import { getBillOfLadingAction } from "@/app/actions/billOfLadingActions";
import { BolPrintLabelsPanel } from "../BolPrintLabelsPanel";
import { BolPreviewPanel } from "../BolPreviewPanel";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** View/reprint entry point for an already-saved bill of lading -- unlike
 * the create flow's success screen (data already in memory), this works
 * off a fresh DB read, so it's usable days later, same reasoning as the
 * real-manifest reprint flow (PrintLabelsFromManifestPanel). */
export default async function BillOfLadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getBillOfLadingAction(id);

  if (!result.success) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
        <p style={{ color: "red" }}>❌ {result.error}</p>
        <Link href="/bol" style={{ color: "#0058b8" }}>← Bill of Lading</Link>
      </div>
    );
  }

  const bol = result.billOfLading;

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <Link href="/bol" style={{ color: "#0058b8" }}>← Bill of Lading</Link>
        <Link href="/bol/new" style={{ color: "#0058b8" }}>+ Create new</Link>
      </p>
      <h1 style={{ color: "#0a2246", fontSize: "28px" }}>{bol.bolNumber}</h1>
      <p style={{ color: "#666" }}>
        Ship date {formatDate(bol.shipDate)} · Created {new Date(bol.createdAt).toLocaleString()}
      </p>

      <p>
        <Link href={`/bol/${bol.id}/print`} target="_blank" style={{ color: "#0058b8" }}>
          Print this bill of lading →
        </Link>
      </p>

      <h3 style={{ color: "#0a2246" }}>Shipper</h3>
      <p>
        {bol.shipperName || "—"} {bol.shipperEpaId && `(${bol.shipperEpaId})`}
        <br />
        {[bol.shipperAddress, bol.shipperCity, bol.shipperState, bol.shipperZip].filter(Boolean).join(", ")}
      </p>

      <h3 style={{ color: "#0a2246" }}>Consignee</h3>
      <p>
        {bol.consigneeName || "—"} {bol.consigneeEpaId && `(${bol.consigneeEpaId})`}
        <br />
        {[bol.consigneeAddress, bol.consigneeCity, bol.consigneeState, bol.consigneeZip].filter(Boolean).join(", ")}
      </p>

      <h3 style={{ color: "#0a2246" }}>Carrier</h3>
      <p>
        {bol.carrierName || "—"} {bol.carrierEpaId && `(${bol.carrierEpaId})`}
      </p>

      <h3 style={{ color: "#0a2246" }}>Line items</h3>
      <ul>
        {bol.lines.map((line) => (
          <li key={line.id}>
            Line {line.lineNumber}: {line.description || "—"} — {line.quantity} {line.unitCode} ·{" "}
            {line.containerNumber} {line.containerTypeCode}
          </li>
        ))}
      </ul>

      <BolPrintLabelsPanel billOfLading={bol} />
      <BolPreviewPanel bolId={bol.id} />
    </div>
  );
}
