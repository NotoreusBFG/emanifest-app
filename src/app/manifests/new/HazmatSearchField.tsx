"use client";

import { useEffect, useRef, useState } from "react";
import { searchHazmatAction } from "@/app/actions/hazmatActions";
import type { HazmatEntry } from "@/lib/hazmat/types";
import { brand } from "@/lib/brandColors";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface HazmatSearchFieldProps {
  placeholder: string;
  onSelect: (entry: HazmatEntry) => void;
}

/**
 * Autocomplete over the parsed 49 CFR §172.101 Hazardous Materials Table
 * (`searchHazmatAction` -> `searchHazmatEntries()`). Selecting a result
 * fills the surrounding waste line's DOT fields via `onSelect`; this
 * component doesn't hold the selected value itself, so manual edits after
 * selection keep working exactly like every other field on the form.
 */
export function HazmatSearchField({ placeholder, onSelect }: HazmatSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HazmatEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      const matches = await searchHazmatAction(query.trim());
      if (cancelled) return;
      setIsLoading(false);
      setResults(matches);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useClickOutside(containerRef, () => setIsOpen(false));

  const handleSelect = (entry: HazmatEntry) => {
    onSelect(entry);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: "8px" }}>
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
            maxHeight: "260px",
            overflowY: "auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {isLoading && <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>Searching…</div>}
          {!isLoading && results.length === 0 && (
            <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>No matches.</div>
          )}
          {!isLoading &&
            results.map((entry, i) => (
              <button
                key={`${entry.idNumbers}-${i}`}
                type="button"
                onClick={() => handleSelect(entry)}
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
                <div style={{ fontWeight: 600, color: brand.navy }}>{entry.properShippingName}</div>
                <div style={{ color: "#666" }}>
                  Class {entry.hazardClass} · {entry.idNumbers} · PG {entry.packingGroup || "—"}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
