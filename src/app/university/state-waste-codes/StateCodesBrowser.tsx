"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  STATE_WASTE_CODES,
  type StateWasteCodeEntry,
  type StateWasteCodeState,
} from "@/lib/stateWasteCodes";

function flattenCodes(entry: StateWasteCodeState): StateWasteCodeEntry[] {
  if (entry.codes) return entry.codes;
  if (entry.codeCategories) return Object.values(entry.codeCategories).flatMap((c) => c.codes);
  return [];
}

function ConfidenceTag({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
      style={
        confirmed
          ? { backgroundColor: "#e6f8f1", color: "#178a63" }
          : { backgroundColor: "#e9eef4", color: "#0a2246" }
      }
    >
      {confirmed ? "Has supplemental codes" : "Confirmed — no supplemental codes"}
    </span>
  );
}

function StateCard({ abbr, entry }: { abbr: string; entry: StateWasteCodeState }) {
  const [expanded, setExpanded] = useState(false);
  const codes = flattenCodes(entry);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-brand-blue">{abbr}</span>
            <h3 className="text-lg font-bold text-brand-navy">{entry.stateName}</h3>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{entry.agency}</p>
        </div>
        <ConfidenceTag confirmed={entry.confidence === "confirmed"} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-700">{entry.relationshipToRcra}</p>

      {entry.regulatoryCitation && (
        <p className="mt-2 text-xs text-gray-400">{entry.regulatoryCitation}</p>
      )}

      {entry.notes?.map((note, i) => (
        <p key={i} className="mt-2 text-xs text-gray-500">
          {note}
        </p>
      ))}

      {codes.length > 0 && (
        <div className="mt-4">
          <Button
            variant="secondary"
            className="!px-4 !py-2 text-sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide codes" : `View ${codes.length} code${codes.length === 1 ? "" : "s"}`}
          </Button>

          {expanded && (
            <div className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200">
              {codes.map((c, i) => (
                <div key={`${abbr}-${c.code}-${i}`} className="flex gap-4 px-4 py-3 text-sm">
                  <span className="w-24 shrink-0 font-bold text-brand-navy">{c.code}</span>
                  <span className="text-gray-600">{c.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-xs text-brand-blue hover:underline"
        >
          View source →
        </a>
      )}
    </Card>
  );
}

export function StateCodesBrowser() {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(STATE_WASTE_CODES)
      .filter(
        ([abbr, entry]) =>
          !q || abbr.toLowerCase().includes(q) || entry.stateName.toLowerCase().includes(q)
      )
      .sort(([, a], [, b]) => a.stateName.localeCompare(b.stateName));
  }, [query]);

  return (
    <div>
      <div className="max-w-sm">
        <Input
          label="Search states"
          placeholder="e.g. California or CA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-4">
        {entries.map(([abbr, entry]) => (
          <StateCard key={abbr} abbr={abbr} entry={entry} />
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-gray-500">No states match &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
}
