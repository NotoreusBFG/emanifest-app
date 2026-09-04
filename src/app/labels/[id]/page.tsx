import { headers } from "next/headers";
import QRCode from "qrcode";
import { getLabelPrintAction } from "@/app/actions/labelActions";
import { PrintButton } from "./PrintButton";

const PHYSICAL_STATE_LABELS = [
  ["solid", "Solid"],
  ["liquid", "Liquid"],
  ["sludge", "Sludge"],
  ["gas", "Gas"],
] as const;

const HAZARD_PROPERTY_LABELS = [
  ["isIgnitable", "Ignitable"],
  ["isCorrosive", "Corrosive"],
  ["isReactive", "Reactive"],
  ["isToxic", "Toxic"],
] as const;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-block h-[11px] w-[11px] flex-none border-[1.4px] border-black"
      style={
        on
          ? {
              backgroundImage:
                "linear-gradient(45deg, transparent 42%, #111 42%, #111 58%, transparent 58%), linear-gradient(-45deg, transparent 42%, #111 42%, #111 58%, transparent 58%)",
            }
          : undefined
      }
    />
  );
}

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

  const dotShippingLine = labelPrint.dotHazardous
    ? [labelPrint.properShippingName, labelPrint.hazardClass, labelPrint.idNumberCode, labelPrint.packingGroup]
        .filter(Boolean)
        .join(", ")
    : labelPrint.wasteDescription;

  const field = "flex flex-col gap-0.5";
  const k = "flex items-baseline gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-gray-600";
  const num = "inline-flex h-[14px] w-[14px] flex-none items-center justify-center rounded-full bg-black text-[8.5px] font-bold text-white";
  const v = "border-b border-dotted border-gray-400 pb-0.5 font-mono text-[12px] font-semibold text-black";

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
          {labelPrint.mmProfileNumber} — printed {new Date(labelPrint.createdAt).toLocaleDateString()}. This
          page is what the QR code on the physical label links to.
        </p>
      </div>

      <div className="flex w-[400px] flex-col border border-gray-300 bg-white text-black shadow-lg print:w-[4in] print:border-0 print:shadow-none">
        <div className="bg-black px-3 py-2.5 text-center text-[25px] font-black uppercase tracking-wide text-white">
          Hazardous Waste
        </div>
        <div className="border-b-2 border-black px-4 py-1.5 text-center text-[9.5px] leading-tight">
          Federal Law Prohibits Improper Disposal. If found, contact the nearest police or public safety
          authority, or the U.S. Environmental Protection Agency.
        </div>

        <div className="flex flex-1 flex-col gap-1.5 px-4 pt-2">
          <div className={field}>
            <div className={k}>
              <span className={num}>1</span>Waste Description
            </div>
            <div className={v}>{labelPrint.profileName || "—"}</div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>2</span>DOT Shipping Name
            </div>
            <div className={v}>{dotShippingLine || "—"}</div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>3</span>Generator
            </div>
            <div className={v}>{labelPrint.generatorName || "—"}</div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>3</span>Address
            </div>
            <div className={`${v} text-[11px]`}>{labelPrint.generatorAddress || "—"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={field}>
              <div className={k}>
                <span className={num}>4</span>EPA ID No.
              </div>
              <div className={`${v} text-[11px]`}>{labelPrint.generatorEpaId || "—"}</div>
            </div>
            <div className={field}>
              <div className={k}>
                <span className={num}>5</span>Manifest Tracking No.
              </div>
              <div className={`${v} text-[11px]`}>{labelPrint.manifestTrackingNumber || "pending"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={field}>
              <div className={k}>
                <span className={num}>6</span>Accum. Start Date
              </div>
              <div className={`${v} text-[16px] font-extrabold border-b-[1.5px] border-black`}>
                {formatDate(labelPrint.accumulationStartDate)}
              </div>
            </div>
            <div className={field}>
              <div className={k}>
                <span className={num}>7</span>Line / Container
              </div>
              <div className={`${v} text-[11px]`}>{labelPrint.lineReference || "—"}</div>
            </div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>8</span>EPA Waste Code(s)
            </div>
            <div className={`${v} text-[11px]`}>{labelPrint.federalWasteCode || "—"}</div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>9</span>Physical State
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              {PHYSICAL_STATE_LABELS.map(([value, label]) => (
                <span key={value} className="flex items-center gap-1.5 font-mono text-[11px]">
                  <CheckBox on={labelPrint.physicalState === value} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className={field}>
            <div className={k}>
              <span className={num}>10</span>Hazardous Properties
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              {HAZARD_PROPERTY_LABELS.map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5 font-mono text-[11px]">
                  <CheckBox on={labelPrint[key]} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 px-4 py-1.5">
          <div className={`${field} flex-1`}>
            <div className={k}>
              <span className={num}>11</span>TSDF Approval #
            </div>
            <div className={`${v} text-[11px]`}>{labelPrint.disposalFacilityProfileNumber || "—"}</div>
          </div>
          <div className="flex flex-none flex-col items-center gap-0.5">
            <div className="h-[52px] w-[52px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="font-mono text-[8px] text-gray-700">{labelPrint.mmProfileNumber}</div>
          </div>
        </div>

        <div className="border-t-2 border-black px-4 py-2.5">
          <div className="text-center text-[10px] font-extrabold">Handle With Care! Contains Hazardous Or Toxic Waste.</div>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
