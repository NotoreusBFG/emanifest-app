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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
              the outer wrapping row) so From and To always stay on the same
              line together — the pair moves as a unit if the row wraps,
              rather than "To" wrapping away from "From" on narrower widths. */}
          <div style={{ display: "flex", gap: "10px" }}>
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
