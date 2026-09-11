import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLabPack } from "@/services/labPackRepository";
import { resolveEffectiveUserId } from "@/services/teamRepository";
import { PrintButton } from "./PrintButton";

/**
 * Printable lab pack packing slip -- the document included alongside a
 * printed manifest for a drum built from /lab-packs. One page, matching the
 * real vendor lab-pack inventory sheet's shape: drum header fields once,
 * then one row per chemical, then a packing certification footer. Browser
 * print only (no PDF library in this project, same as LDR notices).
 */
export default async function LabPackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const effectiveUserId = await resolveEffectiveUserId(supabase, user.id);
  const labPack = await getLabPack(supabase, effectiveUserId, id);
  if (!labPack) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

      <p className="no-print mb-2">
        <Link href="/lab-packs" className="text-brand-blue">
          ← Back to lab packs
        </Link>
      </p>

      <div className="no-print mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-navy">Lab Pack Inventory</h1>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm">
        <h2 className="mb-4 text-center text-lg font-bold text-brand-navy">
          LAB PACK INVENTORY
          <br />
          <span className="text-xs font-normal text-gray-500">
            {labPack.isNonHazardous ? "Non-hazardous" : "40 CFR 268.42(c) / 49 CFR 173.12(b)"}
          </span>
        </h2>

        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="w-1/2 py-1.5 pr-2 align-top font-semibold">Generator</td>
              <td className="w-1/2 py-1.5 align-top font-semibold">Job #</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top">
                {labPack.generatorName || "—"} ({labPack.generatorEpaId || "—"})
              </td>
              <td className="py-1.5 align-top">{labPack.jobNumber || "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td colSpan={2} className="py-1.5 font-semibold">
                DOT Shipping Description
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td colSpan={2} className="py-1.5">
                {labPack.isNonHazardous ? "Non-Hazardous" : labPack.dotShippingDescription || "—"}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top font-semibold">DOT special permit #</td>
              <td className="py-1.5 align-top font-semibold">RQ</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top">{labPack.dotSpecialPermitNumber || "—"}</td>
              <td className="py-1.5 align-top">
                {labPack.rqIndicator ? `Yes — ${labPack.rqCodes || "—"}` : "No"}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top font-semibold">EPA waste code(s)</td>
              <td className="py-1.5 align-top font-semibold">Weight</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top">{labPack.wasteCodes.join(", ") || "—"}</td>
              <td className="py-1.5 align-top">{labPack.totalWeight ?? "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-2 align-top font-semibold">Manifest # / Line #</td>
              <td className="py-1.5 align-top font-semibold">Drum # / Type / Size</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2 align-top">
                {labPack.epaMtn ? `${labPack.epaMtn} / Line ${labPack.manifestLineNumber}` : "Not yet linked to a manifest"}
              </td>
              <td className="py-1.5 align-top">
                {labPack.drumNumber ?? "—"} / {labPack.outerContainerTypeCode} /{" "}
                {labPack.outerContainerSize ? `${labPack.outerContainerSize} gal` : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className="mb-2 mt-5 font-semibold text-brand-navy">Chemicals in this drum</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left uppercase text-gray-500">
              <th className="py-1 pr-2">No.</th>
              <th className="py-1 pr-2">Chemical name</th>
              <th className="py-1 pr-2">Qty</th>
              <th className="py-1 pr-2">Size</th>
              <th className="py-1 pr-2">Phase</th>
              <th className="py-1 pr-2">EPA code(s)</th>
              <th className="py-1">Plant</th>
            </tr>
          </thead>
          <tbody>
            {labPack.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-2">{item.lineNumber}</td>
                <td className="py-1.5 pr-2">{item.chemicalName}</td>
                <td className="py-1.5 pr-2">{item.quantity ?? "—"}</td>
                <td className="py-1.5 pr-2">{item.containerSize || "—"}</td>
                <td className="py-1.5 pr-2">{item.physicalState ?? "—"}</td>
                <td className="py-1.5 pr-2">{item.epaWasteCodes.join(", ") || "—"}</td>
                <td className="py-1.5">{item.sourceLocation || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 border-t border-gray-200 pt-3 text-[11px] text-gray-600">
          <p className="mb-2">
            <strong>Packing Certification</strong> — I authorize that the material packaged in this container,
            including all inventory sheets, adheres to the following: (1) the material is exactly as identified
            above; (2) this lab pack does not contain any radioactive, bio-hazardous, PCB-containing,
            temperature-controlled, or potentially explosive materials; (3) this lab pack has been packed in
            accordance with all applicable D.O.T., E.P.A., T.S.C.A., and state/local regulations.
          </p>
          <div className="mt-6 flex justify-between gap-6 text-[11px]">
            <span className="flex-1 border-t border-gray-400 pt-1">Print name</span>
            <span className="flex-1 border-t border-gray-400 pt-1">Signature</span>
            <span className="w-24 border-t border-gray-400 pt-1">Date</span>
          </div>
        </div>
      </div>

      <p className="no-print mt-3 text-xs text-gray-500">
        Print this alongside the manifest — this is a ManifestMate-only document, not submitted to RCRAInfo.
      </p>
    </div>
  );
}
