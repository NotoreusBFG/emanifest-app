"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  fetchManifestDetailsBatchAction,
  type ManifestBatchResult,
} from "@/app/actions/generatorManifestSearchActions";
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
 * mount and on "Load more".
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
          on print, only the waste-line table below survives; the cards,
          search panel, and site chrome are hidden. */}
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>

      <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>
        Showing {loadedCount} of {total} manifest{total === 1 ? "" : "s"} for{" "}
        <strong style={{ color: brand.navy }}>{resolved.siteName}</strong> ({resolved.epaSiteId})
      </p>

      {total === 0 && (
        <p style={{ color: "#888", fontSize: "14px" }}>
          No manifests found for this generator with the current filters.
        </p>
      )}

      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {results.map((r) => (
          <ManifestResultCard key={r.mtn} result={r} />
        ))}
      </div>

      {isLoading && <p className="no-print" style={{ color: "#888", fontSize: "13px", marginTop: "12px" }}>Loading…</p>}

      {!isLoading && hasMore && (
        <button
          type="button"
          className="no-print"
          onClick={() => loadNextBatch(loadedCount)}
          style={{ ...primaryButtonStyle(false), marginTop: "16px" }}
        >
          Load more ({total - loadedCount} remaining)
        </button>
      )}

      <ManifestWasteLineTable results={results} />
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
  lines: WasteLineRow[];
}

/**
 * Sums container counts (regardless of type — DM/DF/TT/CY etc. all count
 * toward the same total) and quantity grouped by unit, since a single
 * manifest can legitimately mix units across lines (e.g. some in Pounds,
 * others in Gallons) — summing those together would silently produce a
 * meaningless number, so each unit gets its own subtotal instead.
 */
function summarizeManifest(lines: WasteLineRow[]) {
  const totalContainers = lines.reduce((sum, l) => sum + l.containerCount, 0);
  const quantityByUnit = new Map<string, number>();
  for (const l of lines) {
    quantityByUnit.set(l.unit, (quantityByUnit.get(l.unit) ?? 0) + l.quantity);
  }
  const quantityText = Array.from(quantityByUnit.entries())
    .map(([unit, qty]) => `${qty} ${unit}`)
    .join(", ");
  return { totalContainers, quantityText };
}

/**
 * Grouped, printable table — one row per waste line rather than per
 * manifest, grouped by manifest with a subtotal row (total containers,
 * total quantity per unit) after each, across every currently-loaded
 * result (not the full unfetched MTN list; only what's been paged in via
 * "Load more" so far has waste-line detail to show). Separate from the
 * card list above so printing doesn't also print sign-panel-adjacent
 * chrome or wrap awkwardly — Print/Save as PDF via the same
 * window.print()-based PrintButton the LDR notice page already uses.
 */
function ManifestWasteLineTable({ results }: { results: ManifestBatchResult[] }) {
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
    return [{ mtn, lines }];
  });

  const totalLines = groups.reduce((sum, g) => sum + g.lines.length, 0);
  if (totalLines === 0) return null;

  const subtotalCellStyle: CSSProperties = { ...cellStyle, fontWeight: 600, background: brand.tint };

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: brand.navy, margin: 0 }}>
          Waste line table — {totalLines} line{totalLines === 1 ? "" : "s"} from the {groups.length} manifest
          {groups.length === 1 ? "" : "s"} loaded above
        </p>
        <div className="no-print">
          <PrintButton />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: brand.tint }}>
              <th style={cellStyle}>Manifest #</th>
              <th style={cellStyle}>Line #</th>
              <th style={cellStyle}>Container type</th>
              <th style={cellStyle}>Quantity</th>
              <th style={cellStyle}>UOM</th>
              <th style={cellStyle}>Waste codes</th>
              <th style={cellStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const { totalContainers, quantityText } = summarizeManifest(group.lines);
              return (
                <Fragment key={group.mtn}>
                  {group.lines.map((row) => (
                    <tr key={row.key}>
                      <td style={cellStyle}>{group.mtn}</td>
                      <td style={cellStyle}>{row.lineNumber}</td>
                      <td style={cellStyle}>{row.containerType}</td>
                      <td style={cellStyle}>{row.quantity}</td>
                      <td style={cellStyle}>{row.unit}</td>
                      <td style={cellStyle}>{row.wasteCodes}</td>
                      <td style={cellStyle}>{row.description}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={subtotalCellStyle}>
                      Subtotal — {group.mtn}
                    </td>
                    <td style={subtotalCellStyle}>
                      {totalContainers} container{totalContainers === 1 ? "" : "s"}
                    </td>
                    <td colSpan={2} style={subtotalCellStyle}>
                      {quantityText}
                    </td>
                    <td colSpan={2} style={subtotalCellStyle}></td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Lightweight by design — not the full ManifestSummary used on the
 * single-lookup page (sign panel, attachments, LDR status, etc.). This is
 * a browse/scan view; the MTN links to the full single-lookup page
 * (page.tsx's existing ?mtn= deep link) for anything beyond looking at
 * waste lines.
 */
function ManifestResultCard({ result }: { result: ManifestBatchResult }) {
  if (!result.success || !result.manifest) {
    return (
      <Card className="p-4" style={{ borderLeft: "3px solid #c00" }}>
        <p style={{ margin: 0, fontWeight: 600, color: brand.navy }}>{result.mtn}</p>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#c00" }}>
          Couldn&apos;t load this manifest: {result.error}
        </p>
      </Card>
    );
  }

  const manifest = result.manifest;

  return (
    <Card className="p-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
        <Link
          href={`/manifests?mtn=${encodeURIComponent(manifest.manifestTrackingNumber)}`}
          style={{ fontWeight: 700, color: brand.blue, fontSize: "16px" }}
        >
          {manifest.manifestTrackingNumber}
        </Link>
        <span style={{ fontSize: "13px", color: "#666" }}>{manifest.status}</span>
      </div>
      <p style={{ margin: "4px 0 8px", fontSize: "13px", color: "#666" }}>
        Designated facility: {manifest.designatedFacility?.name ?? "—"}
      </p>

      {manifest.wastes.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>No waste lines.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
          {manifest.wastes.map((w) => (
            <li key={w.lineNumber}>
              Line {w.lineNumber}: {w.dotInformation?.printedDotInformation ?? w.wasteDescription} —{" "}
              {w.quantity.quantity} {w.quantity.unitOfMeasurement.description ?? w.quantity.unitOfMeasurement.code}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
