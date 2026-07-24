"use client";

import { useEffect, useRef, useState } from "react";
import { searchSitesAction } from "@/app/actions/manifestActions";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2; // matches RCRAInfo's own minimum for `name`/`epaSiteId`

interface SiteSearchFieldProps {
  siteType: "Generator" | "Transporter" | "Tsdf" | "Broker";
  placeholder: string;
  onSelect: (site: SiteSearchResultItem) => void;
}

/**
 * Autocomplete for looking up a registered EPA site by name, backed by
 * `POST /site-search` (see `searchSites()` in client.ts — NOT YET
 * CONFIRMED LIVE). Selecting a result fills the surrounding form via
 * `onSelect`; this component doesn't hold the selected value itself; the
 * parent's existing controlled state remains the source of truth so
 * manual edits after selection keep working exactly as before.
 */
export function SiteSearchField({ siteType, placeholder, onSelect }: SiteSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteSearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      const state = await searchSitesAction({ name: query.trim(), siteType });
      if (cancelled) return;
      setIsLoading(false);
      if (state.success) {
        setResults(state.sites);
        setError(null);
      } else {
        setResults([]);
        setError(state.error);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, siteType]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (site: SiteSearchResultItem) => {
    onSelect(site);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: "12px" }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: "4px",
          border: `1px solid ${brand.blue}`,
          boxSizing: "border-box",
        }}
      />
      {isOpen && query.trim().length >= MIN_QUERY_LENGTH && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            marginTop: "2px",
            maxHeight: "220px",
            overflowY: "auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {isLoading && <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>Searching…</div>}
          {!isLoading && error && (
            <div style={{ padding: "8px", fontSize: "13px", color: "#c00" }}>{error}</div>
          )}
          {!isLoading && !error && results.length === 0 && (
            <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>No matches.</div>
          )}
          {!isLoading &&
            results.map((site) => (
              <button
                key={site.epaSiteId}
                type="button"
                onClick={() => handleSelect(site)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px",
                  border: "none",
                  borderBottom: "1px solid #eee",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                <div style={{ fontWeight: 600, color: brand.navy }}>{site.name}</div>
                <div style={{ color: "#666" }}>
                  {site.epaSiteId}
                  {site.siteAddress?.city ? ` — ${site.siteAddress.city}, ${site.siteAddress.state?.code ?? ""}` : ""}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
