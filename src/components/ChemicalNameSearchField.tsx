"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { searchChemicalWasteCodesAction } from "@/app/actions/chemicalSearchActions";
import { listCustomWasteCodesAction } from "@/app/actions/customWasteCodeActions";
import { UN_WASTE_CODES } from "@/lib/wasteCodeReference";
import type { CustomWasteCode } from "@/services/customWasteCodeRepository";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;
const MIN_QUERY_LENGTH = 2;

/** A chemical entry from either data source, normalized to one shape for
 * searching/matching -- static UN_WASTE_CODES (shippingName/notes) and
 * the user's own custom_waste_codes (chemicalName/notes) are otherwise
 * differently named. */
interface LocalEntry {
  name: string;
  codes: string[];
  note: string | null;
}

function toLocalEntry(e: { shippingName: string; fCodes: string[]; uCodes: string[]; pCodes: string[]; dCodes: string[]; notes: string }): LocalEntry {
  return { name: e.shippingName, codes: [...e.fCodes, ...e.uCodes, ...e.pCodes, ...e.dCodes], note: e.notes || null };
}

function customToLocalEntry(e: CustomWasteCode): LocalEntry {
  return {
    name: e.chemicalName,
    codes: [...e.fCodes, ...e.uCodes, ...e.pCodes, ...e.dCodes],
    note: e.notes || null,
  };
}

interface ChemicalMatch {
  key: string;
  name: string;
  codes: string[];
  /** Curated context (local), a citation-backed explanation (api-cited,
   * from PubChem's HSDB data), or a manual-verification caution
   * (api-unconfirmed, SRS gave codes but nothing corroborated them) --
   * see the render branches below. */
  note: string | null;
  source: "local" | "api-cited" | "api-unconfirmed";
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
 *
 * A CAS-number query always skips tier 1 (the local list has no CAS
 * index) and goes straight to the API -- but once the API resolves a
 * name, that name IS cross-checked against the local list before
 * settling on a result. Without this, searching a CAS number for a
 * chemical the local list already knows more about than SRS (e.g.
 * toluene -- SRS's own database has no F-list entry for it at all, only
 * U220; the local list correctly has both F005 and U220) would silently
 * return the less complete answer just because the user searched by CAS
 * instead of by name. Found live 2026-09-13 while explaining this
 * feature -- not a hypothetical edge case.
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
  const [customEntries, setCustomEntries] = useState<CustomWasteCode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside(containerRef, () => setIsOpen(false));
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    listCustomWasteCodesAction().then(setCustomEntries);
  }, []);

  // The user's own saved chemicals ("build the database as we go") plus
  // the static hand-curated list, merged into one searchable set -- a
  // custom entry can duplicate a static one (harmless, just two rows)
  // rather than needing merge/precedence logic for a rare case.
  const allLocalEntries: LocalEntry[] = useMemo(
    () => [...UN_WASTE_CODES.map(toLocalEntry), ...customEntries.map(customToLocalEntry)],
    [customEntries]
  );

  const trimmed = value.trim();
  const isCasQuery = CAS_PATTERN.test(trimmed);

  /** Exact (case-insensitive) name match only -- a fuzzy match here risks
   * silently attaching one chemical's codes to a different one the API
   * returned, which is worse than showing the API's own (less complete)
   * answer. */
  const findLocalEntryByName = (name: string): LocalEntry | undefined => {
    const target = name.trim().toLowerCase();
    return allLocalEntries.find((e) => e.name.toLowerCase() === target);
  };

  const localMatches: ChemicalMatch[] = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (isCasQuery || q.length < MIN_QUERY_LENGTH) return [];
    return allLocalEntries
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => ({
        key: e.name,
        name: e.name,
        codes: e.codes,
        note: e.note,
        source: "local" as const,
      }));
  }, [trimmed, isCasQuery, allLocalEntries]);

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
      result.matches.map((m, i) => {
        // Prefer the local list's fuller, hand-verified codes when the
        // API resolves to a chemical it already knows -- see module doc.
        const localEntry = findLocalEntryByName(m.name);
        if (localEntry) {
          return {
            key: `${m.name}-${i}`,
            name: localEntry.name,
            codes: localEntry.codes,
            note: localEntry.note,
            source: "local" as const,
          };
        }
        if (m.explanation) {
          return {
            key: `${m.name}-${i}`,
            name: m.name,
            codes: m.codes,
            note: m.explanation,
            source: "api-cited" as const,
          };
        }
        return {
          key: `${m.name}-${i}`,
          name: m.name,
          codes: m.codes,
          note: "Only P/U-list codes confirmed -- verify F/K/D codes manually (40 CFR 261.31-.33).",
          source: "api-unconfirmed" as const,
        };
      })
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
        onFocus={() => {
          setIsOpen(true);
          // Refetch on every focus, not just mount -- picks up a chemical
          // saved to the library moments earlier in this same modal
          // session (e.g. via the quick-add modal's "Save to your
          // chemical list" button) without needing the two components to
          // otherwise talk to each other.
          listCustomWasteCodesAction().then(setCustomEntries);
        }}
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
              <div className="text-xs text-gray-500">{m.codes.length ? m.codes.join(", ") : "No RCRA codes found"}</div>
              {m.note && (
                <div className={`mt-0.5 text-[11px] ${m.source === "api-unconfirmed" ? "text-amber-700" : "text-gray-500"}`}>
                  {m.note}
                </div>
              )}
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
