import { headers } from "next/headers";
import QRCode from "qrcode";
import { getLabelPrintAction } from "@/app/actions/labelActions";
import { LabelCard } from "../LabelCard";
import { PrintButton } from "../[id]/PrintButton";

/** Batch print view for labels generated together from a manifest's waste
 * lines (see PrintLabelsPanel) -- one browser print job covering every
 * label instead of opening each /labels/[id] separately. Each id's QR
 * still points at its own single-label page, same as if it were printed
 * from there directly. */
export default async function LabelBatchPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-navy">No labels to print</h1>
        <p className="mt-2 text-sm text-gray-600">This link is missing the label ids to print.</p>
      </div>
    );
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const proto = headersList.get("x-forwarded-proto") ?? "https";

  const labels = await Promise.all(
    ids.map(async (id) => {
      const labelPrint = await getLabelPrintAction(id);
      if (!labelPrint) return null;
      const labelUrl = host ? `${proto}://${host}/labels/${id}` : `/labels/${id}`;
      const qrSvg = await QRCode.toString(labelUrl, { type: "svg", margin: 0, width: 120 });
      return { labelPrint, qrSvg };
    })
  );
  const found = labels.filter((l): l is NonNullable<typeof l> => l !== null);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-brand-tint px-6 py-10 print:bg-white print:p-0">
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .label-page { break-after: page; }
          .label-page:last-child { break-after: auto; }
        }
      `}</style>

      <div className="no-print text-center">
        <h1 className="text-xl font-bold text-brand-navy">
          {found.length} label{found.length === 1 ? "" : "s"} ready to print
        </h1>
        <p className="mt-1 max-w-md text-sm text-gray-600">
          Each label prints on its own 4x6&quot; page. Check your printer&apos;s page size before printing.
        </p>
      </div>

      {found.length < ids.length && (
        <p className="no-print text-sm text-red-600">
          {ids.length - found.length} label{ids.length - found.length === 1 ? "" : "s"} couldn&apos;t be found and
          {" "}
          {ids.length - found.length === 1 ? "was" : "were"} skipped.
        </p>
      )}

      <div className="flex flex-col items-center gap-6 print:gap-0">
        {found.map(({ labelPrint, qrSvg }) => (
          <div key={labelPrint.id} className="label-page">
            <LabelCard labelPrint={labelPrint} qrSvg={qrSvg} />
          </div>
        ))}
      </div>

      <PrintButton />
    </div>
  );
}
