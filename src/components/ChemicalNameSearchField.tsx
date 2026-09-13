"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { searchChemicalWasteCodesAction } from "@/app/actions/chemicalSearchActions";
import { UN_WASTE_CODES } from "@/lib/wasteCodeReference";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;
const MIN_QUERY_LENGTH = 2;

interface ChemicalMatch {
  key: string;
  name: string;
  codes: string[];
  /** Curated context (local matches) or a manual-verification caution
   * (API matches) -- see the two render branches below. */
  note: string | null;
  source: "local" | "api";
}

/**
 * Chemical name/CAS search for the lab pack quick-add modal (phase 3).
 *
 * Two tiers, not one -- confirmed by live-testing EPA's Substance
 * Registry Services (SRS) API before building this (see srsClient.ts):
 * SRS's name search has no prefix/wildcard matching, so it cannot power a
 * per-keystroke dropdown. Instead:
 * 1. Local, instant: filters the app's own hand-curated UN_WASTE_CODES
 *    (~106 entries) by substring as the user types -- these already carry
 *    verified F/U/P/D codes plus a context note (e.g. "spent acetone =
 *    F003; unused/off-spec product = U002"), better coverage than SRS
 *    gives for these common chemicals.
 * 2. API, on demand: an explicit "Search EPA database" action (SRS by
 *    name or CAS) for anything not in the local list. Only P-list/U-list
 *    codes are ever confirmed this way -- F/K/D codes are flagged as
 *    needing manual verification, never silently omitted or guessed.
 */
export const ChemicalNameSearchField = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (name: string) => void;
  onSelectCodes: (codesText: string) => void;
}>(function ChemicalNameSearchField({ value, onChange, onSelectCodes }, forwardedRef) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiMatches, setApiMatches] = useState<ChemicalMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false));
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  const trimmed = value.trim();
  const isCasQuery = CAS_PATTERN.test(trimmed);

  const localMatches: ChemicalMatch[] = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (isCasQuery || q.length < MIN_QUERY_LENGTH) return [];
    return UN_WASTE_CODES.filter((e) => e.shippingName.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => ({
        key: e.unNumber,
        name: e.shippingName,
        codes: [...e.fCodes, ...e.uCodes, ...e.pCodes, ...e.dCodes],
        note: e.notes || null,
        source: "local" as const,
      }));
  }, [trimmed, isCasQuery]);

  const showApiSearchButton = (isCasQuery || trimmed.length >= 3) && localMatches.length === 0 && apiMatches === null;

  const handleApiSearch = async () => {
    setSearching(true);
    setSearchError(null);
    const result = await searchChemicalWasteCodesAction(trimmed);
    setSearching(false);
    if (!result.success) {
      setSearchError(result.error);
      return;
    }
    setApiMatches(
      result.matches.map((m, i) => ({
        key: `${m.name}-${i}`,
        name: m.name,
        codes: m.codes,
        note: "Only P/U-list codes confirmed -- verify F/K/D codes manually (40 CFR 261.31-.33).",
        source: "api" as const,
      }))
    );
  };

  const handleSelect = (match: ChemicalMatch) => {
    onChange(match.name);
    onSelectCodes(match.codes.join(", "));
    setIsOpen(false);
  };

  const showDropdown = isOpen && (localMatches.length > 0 || apiMatches !== null || showApiSearchButton);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-brand-navy">Chemical name</label>
      <input
        ref={inputRef}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setApiMatches(null);
          setSearchError(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Name or CAS number (e.g. 67-64-1)"
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {localMatches.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleSelect(m)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-brand-tint"
            >
              <div className="font-medium text-brand-navy">{m.name}</div>
              <div className="text-xs text-gray-500">{m.codes.length ? m.codes.join(", ") : "No RCRA codes"}</div>
              {m.note && <div className="mt-0.5 text-[11px] text-gray-500">{m.note}</div>}
            </button>
          ))}

          {apiMatches?.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleSelect(m)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-brand-tint"
            >
              <div className="font-medium text-brand-navy">{m.name}</div>
              <div className="text-xs text-gray-500">{m.codes.length ? m.codes.join(", ") : "No U/P-list code found"}</div>
              <div className="mt-0.5 text-[11px] text-amber-700">{m.note}</div>
            </button>
          ))}
          {apiMatches?.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No EPA database match found.</p>}

          {showApiSearchButton && (
            <button
              type="button"
              onClick={handleApiSearch}
              disabled={searching}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-brand-blue hover:bg-brand-tint disabled:opacity-50"
            >
              {searching ? "Searching EPA database…" : `Search EPA database for "${trimmed}"`}
            </button>
          )}
          {searchError && <p className="px-3 py-2 text-sm text-red-600">{searchError}</p>}
        </div>
      )}
    </div>
  );
});
