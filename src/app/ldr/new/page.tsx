"use client";

import { Suspense, useActionState, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getWasteLineMetadataAction, refetchManifestAction } from "@/app/actions/manifestActions";
import {
  createLdrNoticeAction,
  findActiveLdrNoticeAction,
  type CreateLdrNoticeState,
} from "@/app/actions/ldrActions";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import { FederalWasteCodeField } from "@/app/manifests/new/FederalWasteCodeField";
import type { LdrManagementLetter, LdrNotice, LdrWasteLineEntry } from "@/lib/ldr/types";
import { LDR_MANAGEMENT_LETTERS, LDR_MANAGEMENT_OPTIONS } from "@/lib/ldr/certificationText";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { getWasteCodeInfo } from "@/lib/wasteCodeReference";
import { getTreatmentStandardsForCode } from "@/lib/treatmentStandards";

interface WasteLineEntryState {
  id: number;
  manifestLineNumber: number | null;
  /** Display-only context pulled from the manifest's own DOT shipping
   * description when prefilled via `?mtn=` -- helps confirm/choose the
   * right subcategory. Not part of LdrWasteLineEntry; nothing to store,
   * this manifest already has it. Empty for a standalone (non-prefilled)
   * entry, since there's no manifest to pull it from. */
  shippingDescription: string;
  codes: string; // comma-separated, same shape FederalWasteCodeField already uses
  howManaged: LdrManagementLetter;
  wastewaterCategory: "wastewater" | "nonwastewater";
  subdivision: string;
  constituentsOfConcern: string;
  wasteAnalysisData: string;
}

function emptyEntry(id: number): WasteLineEntryState {
  return {
    id,
    manifestLineNumber: null,
    shippingDescription: "",
    codes: "",
    // Defaults to "A" -- per the user's own real usage pattern, the
    // overwhelming majority of waste needs letter A (requires treatment,
    // no certification), with lab pack (E) the only common alternative.
    howManaged: "A",
    wastewaterCategory: "nonwastewater",
    subdivision: "",
    constituentsOfConcern: "",
    wasteAnalysisData: "",
  };
}

function toLdrWasteLines(entries: WasteLineEntryState[]): LdrWasteLineEntry[] {
  return entries
    .filter((e) => e.codes.trim().length > 0)
    .map((e) => ({
      manifestLineNumber: e.manifestLineNumber,
      epaHazardousWasteNumbers: e.codes.split(",").map((c) => c.trim()).filter(Boolean),
      howManaged: e.howManaged,
      wastewaterCategory: e.wastewaterCategory,
      subdivision: e.subdivision.trim() || undefined,
      constituentsOfConcern: e.constituentsOfConcern.trim() || undefined,
      wasteAnalysisData: e.wasteAnalysisData.trim() || undefined,
    }));
}

// useSearchParams() (for the ?mtn= prefill deep link) requires a Suspense
// boundary in the App Router, same reason /manifests wraps itself.
export default function NewLdrNoticePage() {
  return (
    <Suspense fallback={null}>
      <NewLdrNoticePageInner />
    </Suspense>
  );
}

function NewLdrNoticePageInner() {
  const [state, formAction, isPending] = useActionState<CreateLdrNoticeState | null, FormData>(
    createLdrNoticeAction,
    null
  );

  const [generatorEpaSiteId, setGeneratorEpaSiteId] = useState("");
  const [receivingFacilityEpaSiteId, setReceivingFacilityEpaSiteId] = useState("");
  const [receivingFacilityName, setReceivingFacilityName] = useState("");
  const [epaMtn, setEpaMtn] = useState<string | null>(null);
  const [preparedByName, setPreparedByName] = useState("");
  const [entries, setEntries] = useState<WasteLineEntryState[]>([emptyEntry(0)]);
  const [nextEntryId, setNextEntryId] = useState(1);
  // One typed signature per distinct letter that needs certification,
  // keyed by letter -- a notice can need several at once (e.g. one line
  // as D, another as E), each with its own certification block below.
  const [certSignatures, setCertSignatures] = useState<Record<string, string>>({});

  const [existingNotice, setExistingNotice] = useState<LdrNotice | null>(null);
  const [checkedForExisting, setCheckedForExisting] = useState(false);
  const [supersedePrevious, setSupersedePrevious] = useState(false);

  // Prefill from a real manifest (docs: "reuse WasteLine data already
  // captured for the manifest rather than duplicating entry") -- one entry
  // per actual manifest waste line (not aggregated), each keeping its own
  // captured wastewater/nonwastewater category and manifest line number.
  // howManaged always starts at "A" even when prefilled -- there's no way
  // to derive it from manifest data, and it's the overwhelmingly common
  // real answer anyway.
  const searchParams = useSearchParams();
  const deepLinkMtn = searchParams.get("mtn");

  useEffect(() => {
    if (!deepLinkMtn) return;
    Promise.all([refetchManifestAction(deepLinkMtn), getWasteLineMetadataAction(deepLinkMtn)]).then(
      ([result, metadataByLine]) => {
        if (!result.success) return;
        const manifest = result.manifest;
        setEpaMtn(manifest.manifestTrackingNumber);
        setGeneratorEpaSiteId(manifest.generator.epaSiteId);
        setReceivingFacilityEpaSiteId(manifest.designatedFacility.epaSiteId);
        setReceivingFacilityName(manifest.designatedFacility.name);

        const newEntries: WasteLineEntryState[] = [];
        let nextId = 0;
        for (const w of manifest.wastes) {
          const codes = (w.hazardousWaste?.federalWasteCodes ?? []).map((c) => c.code);
          if (codes.length === 0) continue;
          const meta = metadataByLine[w.lineNumber];
          newEntries.push({
            ...emptyEntry(nextId),
            manifestLineNumber: w.lineNumber,
            shippingDescription: w.dotInformation?.printedDotInformation ?? w.wasteDescription,
            codes: codes.join(", "),
            wastewaterCategory: meta?.wastewaterCategory ?? "nonwastewater",
            // A manifest waste line flagged as a lab pack defaults straight
            // to letter E instead of the generic "A" default.
            howManaged: meta?.isLabPack ? "E" : "A",
          });
          nextId += 1;
        }
        if (newEntries.length > 0) {
          setEntries(newEntries);
          setNextEntryId(nextId);
        }
      }
    );
  }, [deepLinkMtn]);

  // The "do we already have an active notice on file" check (ldr schema.md
  // §5) -- runs whenever generator/facility/codes are all known, so the
  // user finds out a new notice may not even be needed before filling out
  // the rest of the form.
  useEffect(() => {
    const wasteLines = toLdrWasteLines(entries);
    if (!generatorEpaSiteId || !receivingFacilityEpaSiteId || wasteLines.length === 0) {
      setExistingNotice(null);
      setCheckedForExisting(false);
      return;
    }
    let cancelled = false;
    findActiveLdrNoticeAction(generatorEpaSiteId, receivingFacilityEpaSiteId, wasteLines).then((notice) => {
      if (cancelled) return;
      setExistingNotice(notice);
      setCheckedForExisting(true);
      if (!notice) setSupersedePrevious(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries is a plain array rebuilt each render; comparing its derived codes/generator/facility below is what actually matters
  }, [generatorEpaSiteId, receivingFacilityEpaSiteId, JSON.stringify(entries)]);

  // Distinct letters among current entries that need a signed
  // certification -- drives which certification blocks render below.
  const lettersNeedingCert = useMemo(() => {
    const set = new Set<LdrManagementLetter>();
    for (const e of entries) {
      if (e.codes.trim() && LDR_MANAGEMENT_OPTIONS[e.howManaged].requiresCertification) set.add(e.howManaged);
    }
    return Array.from(set);
  }, [entries]);

  const wasteLinesJson = JSON.stringify(toLdrWasteLines(entries));
  const certificationSignaturesJson = JSON.stringify(certSignatures);
  const blockedByExisting = existingNotice !== null && !supersedePrevious;

  return (
    <div style={{ maxWidth: "760px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <p>
        <Link href="/ldr" style={{ color: brand.blue }}>
          ← Back to LDR notices
        </Link>
      </p>
      <h1 style={{ color: brand.navy }}>File an LDR notice</h1>
      <p style={{ color: "#666" }}>
        40 CFR 268.7(a) — a one-time notice per generator, waste stream, and receiving facility.
        Not submitted to EPA; kept here as ManifestMate&apos;s own record for you to provide to the
        receiving facility. New to LDR?{" "}
        <Link href="/university/land-disposal-restrictions" style={{ color: brand.blue }}>
          Read the Haz Waste University explainer →
        </Link>
      </p>

      {checkedForExisting && existingNotice && (
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #e0a100",
            borderRadius: "6px",
            padding: "12px 14px",
            margin: "16px 0",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: 0 }}>
            ⚠️ You already have an <strong>active</strong> LDR notice on file for this generator,
            facility, and waste code combination — prepared {existingNotice.preparedDate}
            {existingNotice.certifications.length > 0
              ? ` with ${existingNotice.certifications.length} certification${existingNotice.certifications.length > 1 ? "s" : ""} on file`
              : ""}
            . Per 268.7(a), a new one usually isn&apos;t needed unless the waste or facility has
            changed.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
            <input
              type="checkbox"
              checked={supersedePrevious}
              onChange={(e) => setSupersedePrevious(e.target.checked)}
            />
            The waste or facility has changed — file a new notice and supersede the one above
          </label>
        </div>
      )}

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
        <input type="hidden" name="generatorEpaSiteId" value={generatorEpaSiteId} />
        <input type="hidden" name="receivingFacilityEpaSiteId" value={receivingFacilityEpaSiteId} />
        <input type="hidden" name="receivingFacilityName" value={receivingFacilityName} />
        <input type="hidden" name="epaMtn" value={epaMtn ?? ""} />
        <input type="hidden" name="preparedByName" value={preparedByName} />
        <input type="hidden" name="wasteLinesJson" value={wasteLinesJson} />
        <input type="hidden" name="certificationSignaturesJson" value={certificationSignaturesJson} />
        <input type="hidden" name="supersedePrevious" value={String(supersedePrevious)} />

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Generator</label>
          <SiteSearchField
            siteType="Generator"
            placeholder="Search generator by name…"
            onSelect={(site) => setGeneratorEpaSiteId(site.epaSiteId)}
          />
          <input
            value={generatorEpaSiteId}
            onChange={(e) => setGeneratorEpaSiteId(e.target.value)}
            placeholder="EPA ID"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Receiving facility</label>
          <SiteSearchField
            siteType="Tsdf"
            placeholder="Search receiving facility by name…"
            onSelect={(site) => {
              setReceivingFacilityEpaSiteId(site.epaSiteId);
              setReceivingFacilityName(site.name);
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={receivingFacilityEpaSiteId}
              onChange={(e) => setReceivingFacilityEpaSiteId(e.target.value)}
              placeholder="EPA ID"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={receivingFacilityName}
              onChange={(e) => setReceivingFacilityName(e.target.value)}
              placeholder="Facility name"
              style={{ ...inputStyle, flex: 2 }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Waste line(s)</label>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{ border: "1px solid #eee", borderRadius: "6px", padding: "10px", marginBottom: "8px" }}
            >
              {entry.shippingDescription && (
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    fontStyle: "italic",
                    color: brand.navy,
                    background: brand.tint,
                    padding: "6px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {entry.shippingDescription}
                </p>
              )}
              {entry.manifestLineNumber !== null && (
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#888" }}>
                  Manifest line {entry.manifestLineNumber}
                </p>
              )}
              <FederalWasteCodeField
                name={`entry-codes-${entry.id}`}
                value={entry.codes}
                onChange={(v) => setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, codes: v } : e)))}
              />

              <WasteCodeReferenceHint
                codes={entry.codes}
                onUse={(description) =>
                  setEntries((es) =>
                    es.map((en) =>
                      en.id === entry.id && !en.constituentsOfConcern.trim()
                        ? { ...en, constituentsOfConcern: description }
                        : en
                    )
                  )
                }
              />

              <TreatmentStandardHint
                codes={entry.codes}
                wastewaterCategory={entry.wastewaterCategory}
                onUseSubdivision={(subdivision) =>
                  setEntries((es) => es.map((en) => (en.id === entry.id ? { ...en, subdivision } : en)))
                }
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  marginTop: "8px",
                  fontWeight: entry.howManaged === "E" ? 600 : 400,
                }}
              >
                <input
                  type="checkbox"
                  checked={entry.howManaged === "E"}
                  onChange={(e) =>
                    setEntries((es) =>
                      es.map((en) => (en.id === entry.id ? { ...en, howManaged: e.target.checked ? "E" : "A" } : en))
                    )
                  }
                />
                This is a lab pack (40 CFR 268.42(c)) — selects letter E below
              </label>

              <div style={{ marginTop: "8px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#888", marginBottom: "3px" }}>
                  How must this waste be managed? (40 CFR 268.7(a)(4))
                </label>
                <select
                  value={entry.howManaged}
                  onChange={(e) =>
                    setEntries((es) =>
                      es.map((en) => (en.id === entry.id ? { ...en, howManaged: e.target.value as LdrManagementLetter } : en))
                    )
                  }
                  style={{ ...inputStyle, width: "100%" }}
                >
                  {LDR_MANAGEMENT_LETTERS.map((letter) => (
                    <option key={letter} value={letter}>
                      {LDR_MANAGEMENT_OPTIONS[letter].shortLabel}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: LDR_MANAGEMENT_OPTIONS[entry.howManaged].requiresCertification ? "#a15c00" : "#888" }}>
                  {LDR_MANAGEMENT_OPTIONS[entry.howManaged].requiresCertification
                    ? "Requires a signed certification (below)."
                    : "Notice only — no certification needed."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <select
                  value={entry.wastewaterCategory}
                  onChange={(e) =>
                    setEntries((es) =>
                      es.map((en) =>
                        en.id === entry.id ? { ...en, wastewaterCategory: e.target.value as "wastewater" | "nonwastewater" } : en
                      )
                    )
                  }
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value="nonwastewater">Nonwastewater</option>
                  <option value="wastewater">Wastewater</option>
                </select>
                <input
                  value={entry.subdivision}
                  onChange={(e) =>
                    setEntries((es) => es.map((en) => (en.id === entry.id ? { ...en, subdivision: e.target.value } : en)))
                  }
                  placeholder="Subdivision (e.g. D003 reactive cyanide) — optional"
                  style={{ ...inputStyle, flex: 1, minWidth: "220px" }}
                />
              </div>
              {entry.codes.split(",").map((c) => c.trim().toUpperCase()).includes("D001") && (
                <button
                  type="button"
                  onClick={() =>
                    setEntries((es) =>
                      es.map((en) =>
                        en.id === entry.id
                          ? {
                              ...en,
                              subdivision: "D001 High TOC Ignitable Liquids Subcategory (≥10% Total Organic Carbon)",
                              wastewaterCategory: "nonwastewater",
                            }
                          : en
                      )
                    )
                  }
                  style={{
                    marginTop: "4px",
                    background: "none",
                    border: "none",
                    color: brand.blue,
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  D001 detected — use the High TOC Ignitable Liquids Subcategory (≥10% TOC, nonwastewater)?
                </button>
              )}
              <input
                value={entry.constituentsOfConcern}
                onChange={(e) =>
                  setEntries((es) =>
                    es.map((en) => (en.id === entry.id ? { ...en, constituentsOfConcern: e.target.value } : en))
                  )
                }
                placeholder="Constituents of concern — optional, omit if fully treated/monitored"
                style={{ ...inputStyle, marginTop: "8px" }}
              />
              <input
                value={entry.wasteAnalysisData}
                onChange={(e) =>
                  setEntries((es) => es.map((en) => (en.id === entry.id ? { ...en, wasteAnalysisData: e.target.value } : en)))
                }
                placeholder="Waste analysis data — optional, when available"
                style={{ ...inputStyle, marginTop: "8px" }}
              />
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => setEntries((es) => es.filter((e) => e.id !== entry.id))}
                  style={{ marginTop: "8px", background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: "13px" }}
                >
                  Remove this waste line
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setEntries((es) => [...es, emptyEntry(nextEntryId)]);
              setNextEntryId((n) => n + 1);
            }}
            style={{ background: "none", border: `1px dashed ${brand.blue}`, color: brand.blue, borderRadius: "4px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}
          >
            + Add another waste line
          </button>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            Prepared by (printed name)
          </label>
          <input
            value={preparedByName}
            onChange={(e) => setPreparedByName(e.target.value)}
            required
            style={inputStyle}
          />
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#888" }}>
            Every notice is named and dated, even when none of its waste lines require a signed
            certification below.
          </p>
        </div>

        {lettersNeedingCert.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: brand.navy }}>
              Certification{lettersNeedingCert.length > 1 ? "s" : ""} required
            </label>
            {lettersNeedingCert.map((letter) => {
              const option = LDR_MANAGEMENT_OPTIONS[letter];
              return (
                <div key={letter} style={{ background: brand.tint, borderRadius: "6px", padding: "12px 14px" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: brand.navy }}>{option.heading}</h3>
                  <p style={{ fontSize: "13px", color: "#333", fontStyle: "italic" }}>{option.text}</p>
                  <label style={{ display: "block", marginTop: "8px", fontSize: "13px" }}>
                    Typed signature (full name)
                    <input
                      value={certSignatures[letter] ?? ""}
                      onChange={(e) => setCertSignatures((s) => ({ ...s, [letter]: e.target.value }))}
                      required
                      style={{ ...inputStyle, marginTop: "4px" }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <button type="submit" disabled={isPending || blockedByExisting} style={primaryButtonStyle(isPending || blockedByExisting)}>
          {isPending ? "Saving…" : "File LDR notice"}
        </button>

        {state?.success === false && <p style={{ color: "#c0392b", fontSize: "13px" }}>❌ {state.error}</p>}
        {state?.success && (
          <p style={{ color: brand.green, fontSize: "13px" }}>
            ✅ Notice saved.{" "}
            <Link href={`/ldr/${state.notice.id}`} style={{ color: brand.blue }}>
              View notice →
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Suggested constituents of concern from a curated reference dataset the
 * user supplied (originally `docs/wasteCodeReference.ts`, now
 * `src/lib/wasteCodeReference.ts`) -- covers all D/F/K/P/U codes, not just
 * F-listed. That file's own header is explicit: "NOT authoritative and NOT
 * exhaustive -- generated from a curated research pass, not a live
 * RCRAInfo/eCFR data feed," so this is framed as a starting point to
 * verify, not an authoritative auto-fill -- matches the caution already
 * applied elsewhere in this feature (F-listed constituents were originally
 * left as a bare hint for the same reason, before this reference existed).
 */
function WasteCodeReferenceHint({ codes, onUse }: { codes: string; onUse: (description: string) => void }) {
  const matches = codes
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => getWasteCodeInfo(c))
    .filter((info): info is NonNullable<typeof info> => !!info);

  if (matches.length === 0) return null;

  const combinedDescription = matches.map((m) => `${m.code}: ${m.description}`).join(" ");

  return (
    <div style={{ marginTop: "6px", padding: "8px 10px", background: "#fff8e6", border: "1px solid #e0c08a", borderRadius: "4px" }}>
      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#a15c00", fontWeight: 600 }}>
        Reference data (unverified — confirm before relying on this)
      </p>
      {matches.map((m) => (
        <p key={m.code} style={{ margin: "2px 0", fontSize: "12px", color: "#333" }}>
          <strong>{m.code}</strong> ({m.cfrCitation}) — {m.name}: {m.description}
        </p>
      ))}
      <button
        type="button"
        onClick={() => onUse(combinedDescription)}
        style={{ marginTop: "4px", background: "none", border: "none", color: brand.blue, cursor: "pointer", fontSize: "11.5px", padding: 0 }}
      >
        Use as constituents of concern (only fills if that field is still empty)
      </button>
    </div>
  );
}

/**
 * 40 CFR 268.40 treatment standard(s) for whichever D-codes (D001-D043
 * only -- see src/lib/treatmentStandards.ts) are entered, filtered to the
 * entry's own wastewater/nonwastewater selection. Same "unverified,
 * confirm before relying on this" framing as WasteCodeReferenceHint above
 * -- this doesn't pick the LDR letter for you (whether waste already
 * meets its standard is a fact about that specific batch, not derivable
 * from the code alone), but it does show the real applicable standard as
 * context, and lets a matched subcategory's official name get used
 * directly as the Subdivision field instead of typed free text.
 */
function TreatmentStandardHint({
  codes,
  wastewaterCategory,
  onUseSubdivision,
}: {
  codes: string;
  wastewaterCategory: "wastewater" | "nonwastewater";
  onUseSubdivision: (subdivision: string) => void;
}) {
  const dCodes = codes
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^D0\d\d$/.test(c));

  const rows = dCodes.flatMap((code) => getTreatmentStandardsForCode(code));
  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: "6px", padding: "8px 10px", background: "#eef7f2", border: "1px solid #bfe3d3", borderRadius: "4px" }}>
      <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#1a6b4d", fontWeight: 600 }}>
        40 CFR 268.40 treatment standard (unverified — confirm before relying on this)
      </p>
      {rows.map((row, i) => {
        const standard = row.bothStandard ?? (wastewaterCategory === "wastewater" ? row.wastewaterStandard : row.nonwastewaterStandard);
        if (!standard) return null;
        return (
          <div key={i} style={{ margin: "4px 0" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#333" }}>
              <strong>{row.code}</strong>
              {row.subcategory ? ` — ${row.subcategory}` : ""}
              {row.regulatedConstituent ? ` (${row.regulatedConstituent})` : ""}: {standard}
            </p>
            {row.subcategory && (
              <button
                type="button"
                onClick={() => onUseSubdivision(row.subcategory!)}
                style={{ background: "none", border: "none", color: brand.blue, cursor: "pointer", fontSize: "11px", padding: 0 }}
              >
                Use this as the subdivision →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
