"use client";

import { useState } from "react";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import {
  resolveGeneratorManifestListAction,
  type GeneratorManifestSearchFilters,
} from "@/app/actions/generatorManifestSearchActions";
import type { SiteSearchResultItem, ManifestStatus } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

export interface ResolvedGenerator {
  epaSiteId: string;
  siteName: string;
  mtns: string[];
}

interface GeneratorSearchPanelProps {
  onResolved: (result: ResolvedGenerator) => void;
}

const STATUS_OPTIONS: ManifestStatus[] = [
  "Pending",
  "Scheduled",
  "InTransit",
  "ReadyForSignature",
  "Signed",
  "Corrected",
  "UnderCorrection",
  "MtnValidationFailed",
  "Deleted",
];

const DATE_TYPE_OPTIONS = [
  { value: "ShippedDate", label: "Shipped date" },
  { value: "ReceivedDate", label: "Received date" },
  { value: "CertifiedDate", label: "Certified date" },
  { value: "UpdatedDate", label: "Updated date" },
] as const satisfies readonly { value: NonNullable<GeneratorManifestSearchFilters["dateType"]>; label: string }[];

const RANGE_PRESETS = [
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "180", label: "Last 180 days", days: 180 },
  { value: "365", label: "Last year", days: 365 },
] as const;

/** YYYY-MM-DD, matching what a native <input type="date"> expects/emits. */
function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Two ways to identify a generator (search by name via the existing
 * SiteSearchField, or type a known EPA ID directly), plus optional status
 * and date-range filters — both genuinely free from the new
 * POST /emanifest/search endpoint (see resolveGeneratorManifestListAction),
 * not client-side post-filtering. Either path resolves to a confirmed
 * {epaSiteId, siteName, mtns} via onResolved; this component holds no
 * results state itself.
 */
export function GeneratorSearchPanel({ onResolved }: GeneratorSearchPanelProps) {
  const [directId, setDirectId] = useState("");
  const [status, setStatus] = useState<ManifestStatus | "">("");
  const [dateType, setDateType] = useState<GeneratorManifestSearchFilters["dateType"] | "">("");
  const [range, setRange] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fills From/To from a preset ("Last 30 days" etc.) rather than requiring
  // the user to compute and type two exact dates by hand. Also defaults
  // Date type to "Updated date" if nothing's chosen yet, since a range is
  // useless without a dateType to apply it to (EPA requires all three
  // together — see buildFilters below) — the user can still override Date
  // type afterward. Picking "Custom…" just stops auto-filling; it doesn't
  // clear whatever's already in From/To, so refining a preset by hand works.
  const applyRangePreset = (value: string) => {
    setRange(value);
    const preset = RANGE_PRESETS.find((p) => p.value === value);
    if (!preset) return;
    const end = new Date();
    const start = new Date(end.getTime() - preset.days * 24 * 60 * 60 * 1000);
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
    setDateType((current) => current || "UpdatedDate");
  };

  const buildFilters = (): GeneratorManifestSearchFilters | undefined => {
    const filters: GeneratorManifestSearchFilters = {};
    if (status) filters.status = status;
    // EPA requires dateType/startDate/endDate together for a date-range
    // search — only send them once all three are actually filled in.
    if (dateType && startDate && endDate) {
      filters.dateType = dateType;
      filters.startDate = new Date(startDate).toISOString();
      filters.endDate = new Date(endDate).toISOString();
    }
    return Object.keys(filters).length > 0 ? filters : undefined;
  };

  const resolve = async (epaSiteId: string) => {
    if (!epaSiteId.trim()) return;
    setIsLoading(true);
    setError(null);
    const result = await resolveGeneratorManifestListAction(epaSiteId, buildFilters());
    setIsLoading(false);
    if (result.success) {
      onResolved({ epaSiteId: result.epaSiteId, siteName: result.siteName, mtns: result.mtns });
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <p style={{ fontSize: "13px", fontWeight: 600, color: brand.navy, margin: "0 0 6px" }}>
        Search by generator name
      </p>
      <SiteSearchField
        siteType="Generator"
        placeholder="Start typing a generator name…"
        onSelect={(site: SiteSearchResultItem) => resolve(site.epaSiteId)}
      />

      <p style={{ fontSize: "13px", fontWeight: 600, color: brand.navy, margin: "16px 0 6px" }}>
        Or enter a generator EPA ID directly
      </p>
      <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
        <input
          type="text"
          value={directId}
          onChange={(e) => setDirectId(e.target.value)}
          placeholder="e.g. VAD000532119"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          disabled={isLoading || !directId.trim()}
          onClick={() => resolve(directId)}
          style={primaryButtonStyle(isLoading)}
        >
          {isLoading ? "Searching…" : "Search"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        style={{
          background: "none",
          border: "none",
          color: brand.blue,
          fontSize: "13px",
          cursor: "pointer",
          padding: 0,
          marginTop: "4px",
        }}
      >
        {showFilters ? "Hide filters" : "Add status / date range filters"}
      </button>

      {showFilters && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "10px",
            padding: "10px",
            background: brand.tint,
            borderRadius: "6px",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ fontSize: "13px" }}>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ManifestStatus | "")}
                style={{ ...inputStyle, marginTop: "2px" }}
              >
                <option value="">Any</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "13px" }}>
              Date type
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value as GeneratorManifestSearchFilters["dateType"] | "")}
                style={{ ...inputStyle, marginTop: "2px" }}
              >
                <option value="">None</option>
                {DATE_TYPE_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Grouped in its own flex container (not just adjacent labels in
              the outer wrapping row) so Range/From/To always stay on the
              same line together — the group moves as a unit if the row
              wraps, rather than "To" wrapping away from "From" on narrower
              widths. */}
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ fontSize: "13px" }}>
              Range
              <select
                value={range}
                onChange={(e) => applyRangePreset(e.target.value)}
                style={{ ...inputStyle, marginTop: "2px" }}
              >
                <option value="">Custom…</option>
                {RANGE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "13px" }}>
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ ...inputStyle, marginTop: "2px" }}
              />
            </label>
            <label style={{ fontSize: "13px" }}>
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ ...inputStyle, marginTop: "2px" }}
              />
            </label>
          </div>
        </div>
      )}

      {error && <p style={{ color: "red", fontSize: "13px", marginTop: "8px" }}>❌ {error}</p>}
    </div>
  );
}
