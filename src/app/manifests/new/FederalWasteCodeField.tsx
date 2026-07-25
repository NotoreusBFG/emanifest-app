"use client";

import { useEffect, useRef, useState } from "react";
import { getFederalWasteCodesAction } from "@/app/actions/manifestActions";
import type { FederalWasteCode } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";

const MIN_QUERY_LENGTH = 1;

interface FederalWasteCodeFieldProps {
  /** Comma-separated codes, e.g. "D001, D003" — same shape the form/action already expects. */
  name: string;
  value: string;
  onChange: (value: string) => void;
}

function parseCodes(value: string): string[] {
  return value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Replaces free-text entry for the manifest's federal waste code field with
 * a picker constrained to RCRAInfo's own live code list
 * (`getFederalWasteCodesAction` -> `GET /lookup/federal-waste-codes`,
 * confirmed live 2026-07-25, 567 codes) — the same class of bug as the
 * literal "None" that once broke the DOT ID number field, closed off here
 * by construction rather than by validation after the fact.
 *
 * The full list (~567 short entries, unlike the ~2MB DOT hazmat table) is
 * fetched once and filtered client-side rather than round-tripping to the
 * server on every keystroke.
 */
export function FederalWasteCodeField({ name, value, onChange }: FederalWasteCodeFieldProps) {
  const [allCodes, setAllCodes] = useState<FederalWasteCode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getFederalWasteCodesAction().then((state) => {
      if (cancelled) return;
      if (state.success) setAllCodes(state.codes);
      else setLoadError(state.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = parseCodes(value);
  const q = query.trim().toLowerCase();
  const matches =
    allCodes && q.length >= MIN_QUERY_LENGTH
      ? allCodes
          .filter((c) => !selected.includes(c.code))
          .filter((c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
          .slice(0, 20)
      : [];

  const addCode = (code: string) => {
    onChange([...selected, code].join(", "));
    setQuery("");
    setIsOpen(false);
  };

  const removeCode = (code: string) => {
    onChange(selected.filter((c) => c !== code).join(", "));
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input type="hidden" name={name} value={value} />

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
          {selected.map((code) => (
            <span
              key={code}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: brand.tint,
                color: brand.navy,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {code}
              <button
                type="button"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: brand.navy,
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        placeholder={
          loadError ? "Waste code list unavailable — see error below" : "Search EPA waste codes (e.g. D001, ignitable)…"
        }
        disabled={!!loadError}
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

      {loadError && <p style={{ color: "red", fontSize: "13px", marginTop: "4px" }}>{loadError}</p>}

      {isOpen && q.length >= MIN_QUERY_LENGTH && !loadError && (
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
          {allCodes === null && (
            <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>Loading codes…</div>
          )}
          {allCodes !== null && matches.length === 0 && (
            <div style={{ padding: "8px", fontSize: "13px", color: "#888" }}>No matching codes.</div>
          )}
          {matches.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => addCode(c.code)}
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
              <strong style={{ color: brand.navy }}>{c.code}</strong>{" "}
              <span style={{ color: "#666" }}>{c.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
