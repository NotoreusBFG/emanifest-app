import Link from "next/link";
import { getBillOfLadingAction } from "@/app/actions/billOfLadingActions";
import { PrintButton } from "@/app/labels/[id]/PrintButton";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 border border-black">
      <div className="border-b border-black bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{title}</div>
      <div className="px-2 py-2 text-[12px] leading-snug">{children}</div>
    </div>
  );
}

function SignatureLine({ role }: { role: string }) {
  return (
    <div className="flex-1">
      <div className="mb-6 border-b border-black" />
      <div className="text-[10px] uppercase tracking-wide text-gray-600">{role} Signature</div>
      <div className="mt-4 flex gap-4 text-[10px] uppercase tracking-wide text-gray-600">
        <span className="flex-1 border-b border-black">&nbsp;</span>
        <span className="w-24 border-b border-black">&nbsp;</span>
      </div>
      <div className="flex gap-4 text-[9px] text-gray-500">
        <span className="flex-1">Print name</span>
        <span className="w-24">Date</span>
      </div>
    </div>
  );
}

export default async function BillOfLadingPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === "1";
  const result = await getBillOfLadingAction(id);

  if (!result.success) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-navy">Bill of lading not found</h1>
        <p className="mt-2 text-sm text-gray-600">{result.error}</p>
        <Link href="/bol" className="mt-4 inline-block text-brand-blue">
          ← Bill of Lading
        </Link>
      </div>
    );
  }

  const bol = result.billOfLading;

  return (
    <div
      className={
        isEmbed
          ? "flex flex-col items-center bg-white p-3"
          : "flex min-h-screen flex-col items-center gap-6 bg-brand-tint px-6 py-10 print:bg-white print:p-0"
      }
    >
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        ${isEmbed ? ".no-print { display: none !important; }" : ""}
      `}</style>

      {/* Embed mode (the /bol/[id] preview iframe) hides this along with the
          nav chrome and the standalone print button, via the .no-print rule
          above -- same class the real @media print rule already uses. */}
      <div className="no-print text-center">
        <h1 className="text-xl font-bold text-brand-navy">Bill of lading</h1>
        <p className="mt-1 text-sm text-gray-600">{bol.bolNumber} — not submitted to EPA, non-hazardous shipment only.</p>
      </div>

      <div
        className={
          isEmbed
            ? "w-full border border-gray-300 bg-white p-6 text-black"
            : "w-[750px] border border-gray-300 bg-white p-6 text-black shadow-lg print:w-full print:border-0 print:p-0 print:shadow-none"
        }
      >
        <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <div className="text-[26px] font-black uppercase tracking-wide text-black">Bill of Lading</div>
            <div className="text-[11px] text-gray-600">Non-hazardous shipment — not an EPA manifest</div>
          </div>
          <div className="text-right text-[12px]">
            <div>
              <span className="font-bold">BOL #:</span> {bol.bolNumber}
            </div>
            <div>
              <span className="font-bold">Ship date:</span> {formatDate(bol.shipDate)}
            </div>
          </div>
        </div>

        <div className="mb-3 flex gap-3">
          <Box title="Ship From (Shipper)">
            <div className="font-semibold">{bol.shipperName || "—"}</div>
            <div>{bol.shipperAddress}</div>
            <div>
              {[bol.shipperCity, bol.shipperState, bol.shipperZip].filter(Boolean).join(", ") || "—"}
            </div>
            {(bol.shipperContactName || bol.shipperContactPhone) && (
              <div className="mt-1 text-[11px] text-gray-600">
                {bol.shipperContactName} {bol.shipperContactPhone}
              </div>
            )}
            {bol.shipperEpaId && <div className="text-[11px] text-gray-600">EPA ID: {bol.shipperEpaId}</div>}
          </Box>
          <Box title="Ship To (Consignee)">
            <div className="font-semibold">{bol.consigneeName || "—"}</div>
            <div>{bol.consigneeAddress}</div>
            <div>
              {[bol.consigneeCity, bol.consigneeState, bol.consigneeZip].filter(Boolean).join(", ") || "—"}
            </div>
            {(bol.consigneeContactName || bol.consigneeContactPhone) && (
              <div className="mt-1 text-[11px] text-gray-600">
                {bol.consigneeContactName} {bol.consigneeContactPhone}
              </div>
            )}
            {bol.consigneeEpaId && <div className="text-[11px] text-gray-600">EPA ID: {bol.consigneeEpaId}</div>}
          </Box>
        </div>

        <div className="mb-4">
          <Box title="Carrier">
            <div className="font-semibold">{bol.carrierName || "—"}</div>
            {(bol.carrierContactName || bol.carrierContactPhone) && (
              <div className="text-[11px] text-gray-600">
                {bol.carrierContactName} {bol.carrierContactPhone}
              </div>
            )}
            {bol.carrierEpaId && <div className="text-[11px] text-gray-600">EPA ID: {bol.carrierEpaId}</div>}
          </Box>
        </div>

        <table className="mb-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-y-2 border-black bg-gray-100">
              <th className="border border-black px-2 py-1 text-left">Item</th>
              <th className="border border-black px-2 py-1 text-left">Description</th>
              <th className="border border-black px-2 py-1 text-right">Qty</th>
              <th className="border border-black px-2 py-1 text-left">Unit</th>
              <th className="border border-black px-2 py-1 text-right"># Containers</th>
              <th className="border border-black px-2 py-1 text-left">Container Type</th>
            </tr>
          </thead>
          <tbody>
            {bol.lines.map((line) => (
              <tr key={line.id}>
                <td className="border border-black px-2 py-1">{line.lineNumber}</td>
                <td className="border border-black px-2 py-1">
                  {line.description || "—"}
                  {line.specialInstructions && (
                    <div className="text-[10px] italic text-gray-600">{line.specialInstructions}</div>
                  )}
                </td>
                <td className="border border-black px-2 py-1 text-right">{line.quantity || "—"}</td>
                <td className="border border-black px-2 py-1">{line.unitCode || "—"}</td>
                <td className="border border-black px-2 py-1 text-right">{line.containerNumber || "—"}</td>
                <td className="border border-black px-2 py-1">{line.containerTypeCode || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {bol.specialInstructions && (
          <div className="mb-4">
            <Box title="Special Instructions">{bol.specialInstructions}</Box>
          </div>
        )}

        <div className="mb-2 text-[10px] leading-snug text-gray-600">
          This bill of lading is a shipping/receiving record for a non-hazardous waste stream only. It is not
          an EPA hazardous waste manifest and has not been submitted to RCRAInfo.
        </div>

        <div className="mt-6 flex gap-6">
          <SignatureLine role="Shipper" />
          <SignatureLine role="Carrier" />
          <SignatureLine role="Consignee" />
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
