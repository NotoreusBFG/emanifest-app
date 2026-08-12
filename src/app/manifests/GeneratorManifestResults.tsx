"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  fetchManifestDetailsBatchAction,
  type ManifestBatchResult,
} from "@/app/actions/generatorManifestSearchActions";
import { getHandlerSignatureStatus } from "@/lib/rcrainfo/types";
import type { ResolvedGenerator } from "./GeneratorSearchPanel";
import { brand } from "@/lib/brandColors";
import { primaryButtonStyle } from "@/lib/formStyles";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/app/ldr/[id]/PrintButton";

// Bounds every live-fetch round to a small number of RCRAInfo calls
// (mapWithConcurrency limits actual concurrency further, see
// generatorManifestSearchActions.ts) rather than fetching a generator's
// entire manifest history at once — a real generator's MTN list can run
// into the thousands.
const PAGE_SIZE = 15;

interface GeneratorManifestResultsProps {
  resolved: ResolvedGenerator;
}

/**
 * Paginated results for a resolved generator search — the MTN list itself
 * is already known in full (resolved.mtns, from the EPA-filtered
 * /emanifest/search call), but full manifest detail (status, waste lines)
 * is only fetched a page at a time via fetchManifestDetailsBatchAction, on
 * mount and on "Load more". The table (ManifestWasteLineTable) is the only
 * results view — no per-manifest card list, per the user's request to drop
 * that in favor of a single table with a title card above it.
 */
export function GeneratorManifestResults({ resolved }: GeneratorManifestResultsProps) {
  const [results, setResults] = useState<ManifestBatchResult[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Sets (not appends) the first page directly, guarded by a `cancelled`
  // flag — same idiom SiteSearchField's debounced search effect already
  // uses. Needed because React Strict Mode double-invokes mount effects in
  // dev (mount -> cleanup -> mount again): an append-based effect here
  // would silently double every result (confirmed live — every MTN showed
  // a "duplicate key" warning and every card rendered twice). Reusing the
  // shared loadNextBatch/append helper for the initial load would have the
  // same problem, so the first page is loaded independently here.
  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setLoadedCount(0);

    const firstBatch = resolved.mtns.slice(0, PAGE_SIZE);
    if (firstBatch.length > 0) {
      setIsLoading(true);
      fetchManifestDetailsBatchAction(firstBatch).then((batchResults) => {
        if (cancelled) return;
        setResults(batchResults);
        setLoadedCount(firstBatch.length);
        setIsLoading(false);
      });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the resolved generator/filter set itself changes
  }, [resolved]);

  // User-triggered (the "Load more" button below), never called from the
  // mount effect above — a distinct click isn't subject to Strict Mode's
  // double-invoke, so appending here is safe.
  const loadNextBatch = async (startAt: number) => {
    const batch = resolved.mtns.slice(startAt, startAt + PAGE_SIZE);
    if (batch.length === 0) return;
    setIsLoading(true);
    const batchResults = await fetchManifestDetailsBatchAction(batch);
    setResults((prev) => [...prev, ...batchResults]);
    setLoadedCount(startAt + batch.length);
    setIsLoading(false);
  };

  const total = resolved.mtns.length;
  const hasMore = loadedCount < total;

  return (
    <div>
      {/* Reuses the LDR detail page's print setup (same .no-print
          convention already applied to the sidebar/header in layout.tsx) —
          on print, only the waste-line table below survives; the title
          card, search panel, and site chrome are hidden. */}
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

      <Card className="p-4 no-print" style={{ marginBottom: "16px" }}>
        <p style={{ margin: 0, fontWeight: 700, color: brand.navy, fontSize: "18px" }}>{resolved.siteName}</p>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
          EPA ID: {resolved.epaSiteId} · Showing {loadedCount} of {total} manifest{total === 1 ? "" : "s"}
        </p>
      </Card>

      {total === 0 && (
        <p style={{ color: "#888", fontSize: "14px" }}>
          No manifests found for this generator with the current filters.
        </p>
      )}

      {isLoading && <p className="no-print" style={{ color: "#888", fontSize: "13px", marginBottom: "12px" }}>Loading…</p>}

      {!isLoading && hasMore && (
        <button
          type="button"
          className="no-print"
          onClick={() => loadNextBatch(loadedCount)}
          style={{ ...primaryButtonStyle(false), marginBottom: "16px" }}
        >
          Load more ({total - loadedCount} remaining)
        </button>
      )}

      <ManifestWasteLineTable results={results} epaSiteId={resolved.epaSiteId} />
    </div>
  );
}

const cellStyle: CSSProperties = { padding: "6px 8px", border: "1px solid #ddd", textAlign: "left" };

interface WasteLineRow {
  key: string;
  lineNumber: number;
  quantity: number;
  unit: string;
  containerType: string;
  containerCount: number;
  wasteCodes: string;
  description: string;
}

interface ManifestGroup {
  mtn: string;
  /** getHandlerSignatureStatus(manifest.generator).signatureDate — when the
   * generator actually signed, not manifest.createdDate. */
  generatorSignedDate?: string;
  /** manifest.receivedDate — EPA's own "received at the designated
   * facility" field (Item 20 on the paper form), not the facility's own
   * signature timestamp, which can differ. Same field ManifestSummary
   * already displays on the single-lookup page. */
  receivedDate?: string;
  generatorName: string;
  generatorEpaId: string;
  /** A manifest can have multiple transporters (order 1, 2, ...) — joined
   * with "; " rather than dropping any, since this is a single CSV cell per
   * manifest, not one row per transporter. */
  transporterName: string;
  transporterEpaId: string;
  /** Always populated regardless of signature status — the designated
   * facility is known at manifest creation, independent of whether anyone's
   * signed yet, so an unsigned manifest still shows where it was headed. */
  facilityName: string;
  facilityEpaId: string;
  lines: WasteLineRow[];
}

interface FailedManifest {
  mtn: string;
  error: string;
}

function formatDateOnly(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

interface UnitSubtotal {
  unit: string;
  containers: number;
  amount: number;
}

/**
 * Groups a manifest's lines by unit and subtotals containers + amount
 * *within* each unit group — a manifest mixing Pounds and Gallons across
 * lines gets two separate sub-subtotals (e.g. "10 containers, 1500 Pounds"
 * and "3 containers, 300 Gallons"), never one combined, meaningless number
 * that adds pounds to gallons. Container type (DM/DF/etc.) isn't part of
 * the grouping key — a manifest can use different container types for the
 * same unit, and the per-line rows above already show which type each line
 * used; the subtotal is EPA-manifest-style (matches Item 11/12's own
 * per-waste-line-item subtotal convention), grouped by unit only.
 */
function summarizeManifestByUnit(lines: WasteLineRow[]): UnitSubtotal[] {
  const byUnit = new Map<string, UnitSubtotal>();
  for (const l of lines) {
    const existing = byUnit.get(l.unit) ?? { unit: l.unit, containers: 0, amount: 0 };
    existing.containers += l.containerCount;
    existing.amount += l.quantity;
    byUnit.set(l.unit, existing);
  }
  return Array.from(byUnit.values());
}

/** RFC 4180 — quote a field if it contains a comma, quote, or newline, doubling any internal quotes. */
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Column order per user spec (2026-08-12): A Manifest #, B Generator Signed
 * Date, C Generator Name, D Generator EPA ID, E Transporter Name,
 * F Transporter EPA ID, G Received At Facility Date, then the original
 * chart continues unchanged (Disposal Facility Name/EPA ID, Line #,
 * Description, # of Containers, Container Type, Amount, Amount Units,
 * Waste Codes) — repeated per line, since CSV has no concept of a grouping
 * header row the way the on-screen table does.
 */
function buildCsv(groups: ManifestGroup[]): string {
  const headers = [
    "Manifest #",
    "Generator Signed Date",
    "Generator Name",
    "Generator EPA ID",
    "Transporter Name",
    "Transporter EPA ID",
    "Received At Facility Date",
    "Disposal Facility Name",
    "Disposal Facility EPA ID",
    "Line #",
    "Description",
    "# of Containers",
    "Container Type",
    "Amount",
    "Amount Units",
    "Waste Codes",
  ];
  const rows = groups.flatMap((g) =>
    g.lines.map((row) => [
      g.mtn,
      formatDateOnly(g.generatorSignedDate),
      g.generatorName,
      g.generatorEpaId,
      g.transporterName,
      g.transporterEpaId,
      formatDateOnly(g.receivedDate),
      g.facilityName,
      g.facilityEpaId,
      row.lineNumber,
      row.description,
      row.containerCount,
      row.containerType,
      row.quantity,
      row.unit,
      row.wasteCodes,
    ])
  );
  return [headers, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n");
}

function downloadCsv(groups: ManifestGroup[], epaSiteId: string) {
  const csv = buildCsv(groups);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `waste-line-table-${epaSiteId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The results view — one row per waste line rather than per manifest,
 * grouped by manifest with a header row (signed/received dates, disposal
 * facility) above each group's lines and a subtotal row (per unit) after.
 * Print/Save as PDF via the same window.print()-based PrintButton the LDR
 * notice page already uses; CSV export builds client-side from the same
 * `groups` data, no extra server round-trip.
 */
function ManifestWasteLineTable({ results, epaSiteId }: { results: ManifestBatchResult[]; epaSiteId: string }) {
  const groups: ManifestGroup[] = results.flatMap((r) => {
    if (!r.success || !r.manifest) return [];
    const mtn = r.manifest.manifestTrackingNumber;
    const lines: WasteLineRow[] = r.manifest.wastes.map((w) => {
      const wasteCodes = [
        ...(w.hazardousWaste?.federalWasteCodes ?? []),
        ...(w.hazardousWaste?.generatorWasteCodes ?? []),
      ]
        .map((c) => c.code)
        .join(", ");
      return {
        key: `${mtn}-${w.lineNumber}`,
        lineNumber: w.lineNumber,
        quantity: w.quantity.quantity,
        unit: w.quantity.unitOfMeasurement.description ?? w.quantity.unitOfMeasurement.code,
        containerType: w.quantity.containerType?.code ?? "—",
        containerCount: w.quantity.containerNumber ?? 0,
        wasteCodes: wasteCodes || "—",
        description: w.dotInformation?.printedDotInformation ?? w.wasteDescription,
      };
    });
    return [
      {
        mtn,
        generatorSignedDate: getHandlerSignatureStatus(r.manifest.generator).signatureDate,
        receivedDate: r.manifest.receivedDate,
        generatorName: r.manifest.generator?.name ?? "—",
        generatorEpaId: r.manifest.generator?.epaSiteId ?? "—",
        transporterName: r.manifest.transporters?.map((t) => t.name).filter(Boolean).join("; ") || "—",
        transporterEpaId: r.manifest.transporters?.map((t) => t.epaSiteId).filter(Boolean).join("; ") || "—",
        facilityName: r.manifest.designatedFacility?.name ?? "—",
        facilityEpaId: r.manifest.designatedFacility?.epaSiteId ?? "—",
        lines,
      },
    ];
  });

  const failures: FailedManifest[] = results
    .filter((r) => !r.success || !r.manifest)
    .map((r) => ({ mtn: r.mtn, error: r.error ?? "Unknown error" }));

  const totalLines = groups.reduce((sum, g) => sum + g.lines.length, 0);
  if (totalLines === 0 && failures.length === 0) return null;

  const subtotalCellStyle: CSSProperties = { ...cellStyle, fontWeight: 600, background: brand.tint };
  const manifestHeaderCellStyle: CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    background: brand.navy,
    color: "white",
    borderColor: brand.navy,
  };
  const errorCellStyle: CSSProperties = { ...cellStyle, background: "#fdecea", color: "#c0392b" };

  return (
    <div style={{ marginTop: "24px", marginLeft: "-200px", marginRight: "-200px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: brand.navy, margin: 0 }}>
          Waste line table — {totalLines} line{totalLines === 1 ? "" : "s"} from the {groups.length} manifest
          {groups.length === 1 ? "" : "s"} loaded above
        </p>
        <div className="no-print" style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => downloadCsv(groups, epaSiteId)}
            disabled={groups.length === 0}
            style={primaryButtonStyle(groups.length === 0)}
          >
            Export CSV
          </button>
          <PrintButton />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: brand.tint }}>
              <th style={cellStyle}>Manifest #</th>
              <th style={cellStyle}>Line #</th>
              <th style={cellStyle}>Description</th>
              <th style={cellStyle}># of containers</th>
              <th style={cellStyle}>Container type</th>
              <th style={cellStyle}>Amount</th>
              <th style={cellStyle}>Amount units</th>
              <th style={cellStyle}>Waste codes</th>
            </tr>
          </thead>
          <tbody>
            {failures.map((f) => (
              <tr key={f.mtn}>
                <td colSpan={8} style={errorCellStyle}>
                  {f.mtn} — Couldn&apos;t load: {f.error}
                </td>
              </tr>
            ))}
            {groups.map((group) => {
              const unitSubtotals = summarizeManifestByUnit(group.lines);
              return (
                <Fragment key={group.mtn}>
                  <tr>
                    <td colSpan={8} style={manifestHeaderCellStyle}>
                      <Link
                        href={`/manifests?mtn=${encodeURIComponent(group.mtn)}`}
                        style={{ color: "white", textDecoration: "underline" }}
                      >
                        {group.mtn}
                      </Link>{" "}
                      — Generator signed: {formatDateOnly(group.generatorSignedDate)} · Received at designated
                      facility: {formatDateOnly(group.receivedDate)} — {group.facilityName} ({group.facilityEpaId})
                    </td>
                  </tr>
                  {group.lines.map((row) => (
                    <tr key={row.key}>
                      <td style={cellStyle}>{group.mtn}</td>
                      <td style={cellStyle}>{row.lineNumber}</td>
                      <td style={cellStyle}>{row.description}</td>
                      <td style={cellStyle}>{row.containerCount}</td>
                      <td style={cellStyle}>{row.containerType}</td>
                      <td style={cellStyle}>{row.quantity}</td>
                      <td style={cellStyle}>{row.unit}</td>
                      <td style={cellStyle}>{row.wasteCodes}</td>
                    </tr>
                  ))}
                  {/* One subtotal row per unit present on this manifest —
                      see summarizeManifestByUnit's comment for why these
                      aren't combined into a single row. */}
                  {unitSubtotals.map((sub) => (
                    <tr key={`${group.mtn}-subtotal-${sub.unit}`}>
                      <td colSpan={3} style={subtotalCellStyle}>
                        Subtotal — {group.mtn} ({sub.unit})
                      </td>
                      <td style={subtotalCellStyle}>
                        {sub.containers} container{sub.containers === 1 ? "" : "s"}
                      </td>
                      <td style={subtotalCellStyle}></td>
                      <td style={subtotalCellStyle}>{sub.amount}</td>
                      <td style={subtotalCellStyle}>{sub.unit}</td>
                      <td style={subtotalCellStyle}></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
