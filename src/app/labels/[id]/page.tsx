import { headers } from "next/headers";
import QRCode from "qrcode";
import { getLabelPrintAction } from "@/app/actions/labelActions";
import { LabelCard } from "../LabelCard";
import { PrintButton } from "./PrintButton";

export default async function LabelPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const labelPrint = await getLabelPrintAction(id);

  if (!labelPrint) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-navy">Label not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          This link doesn&apos;t match a printed label. It may have been removed, or the link was mistyped.
        </p>
      </div>
    );
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const labelUrl = host ? `${proto}://${host}/labels/${labelPrint.id}` : `/labels/${labelPrint.id}`;
  const qrSvg = await QRCode.toString(labelUrl, { type: "svg", margin: 0, width: 120 });

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-brand-tint px-6 py-10 print:bg-white print:p-0">
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print text-center">
        <h1 className="text-xl font-bold text-brand-navy">Hazardous waste container label</h1>
        <p className="mt-1 max-w-md text-sm text-gray-600">
          {labelPrint.mmProfileNumber ?? labelPrint.manifestTrackingNumber} — printed{" "}
          {new Date(labelPrint.createdAt).toLocaleDateString()}. This page is what the QR code on the
          physical label links to.
        </p>
      </div>

      <LabelCard labelPrint={labelPrint} qrSvg={qrSvg} />

      <PrintButton />
    </div>
  );
}
