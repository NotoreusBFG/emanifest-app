"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  lookupManifestAction,
  refetchManifestAction,
  listStoredDocumentsAction,
  type LookupManifestState,
  type StoredDocument,
} from "@/app/actions/manifestActions";
import { getHandlerSignatureStatus, type Handler, type Manifest } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { Card } from "@/components/ui/Card";
import { SignManifestPanel } from "./SignManifestPanel";
import { SendSignLink } from "@/components/SendSignLink";
import { findActiveLdrNoticeAction } from "@/app/actions/ldrActions";
import type { LdrNotice, LdrWasteLineEntry } from "@/lib/ldr/types";
import { formatElapsedHours, getTransporterTimingInfo, TRANSPORTER_TIMING_COLOR } from "@/lib/transporterTiming";

// useSearchParams() (for the ?mtn= deep link from /dashboard) requires a
// Suspense boundary in the App Router, or the build fails.
export default function ManifestLookupPage() {
  return (
    <Suspense fallback={null}>
      <ManifestLookupPageInner />
    </Suspense>
  );
}

function ManifestLookupPageInner() {
  const [state, formAction, isPending] = useActionState<LookupManifestState, FormData>(
    lookupManifestAction,
    null
  );

  // Held separately from `state` so a post-sign refresh can update what's
  // displayed without re-running the lookup form's own action/pending state.
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    if (state?.success) setManifest(state.manifest);
  }, [state]);

  const refresh = async () => {
    if (!manifest) return;
    const fresh = await refetchManifestAction(manifest.manifestTrackingNumber);
    if (fresh.success) setManifest(fresh.manifest);
  };

  // Deep link from the dashboard (/manifests?mtn=...) — loads straight into
  // full detail without the user re-typing/pasting the MTN into the form.
  const searchParams = useSearchParams();
  const deepLinkMtn = searchParams.get("mtn");

  useEffect(() => {
    if (deepLinkMtn) {
      refetchManifestAction(deepLinkMtn).then((result) => {
        if (result.success) setManifest(result.manifest);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the URL's mtn param itself changes
  }, [deepLinkMtn]);

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <Link href="/settings" style={{ color: brand.blue }}>← Settings</Link>
        <Link href="/manifests/new" style={{ color: brand.blue }}>+ Create new manifest</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Look up a manifest</h1>
      <p style={{ color: "#666" }}>
        Enter an e-Manifest tracking number to see its current status.
      </p>

      <form action={formAction} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          name="mtn"
          type="text"
          placeholder="e.g. 100091730ELC"
          required
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" disabled={isPending} style={primaryButtonStyle(isPending)}>
          {isPending ? "Looking up..." : "Look up"}
        </button>
      </form>

      {state && !state.success && (
        <p style={{ color: "red" }}>❌ {state.error}</p>
      )}

      {manifest && <ManifestSummary manifest={manifest} onSigned={refresh} />}
    </div>
  );
}

function ManifestSummary({
  manifest,
  onSigned,
}: {
  manifest: Manifest;
  onSigned: () => void;
}) {
  return (
    <Card className="p-5">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <h2 style={{ margin: 0, color: brand.navy, fontSize: "28px", fontWeight: 800 }}>
          {manifest.manifestTrackingNumber}
        </h2>
        <SendSignLink mtn={manifest.manifestTrackingNumber} manifest={manifest} />
      </div>
      <p>
        <strong>Status:</strong> {manifest.status}
        {" · "}
        <strong>Submission type:</strong> {manifest.submissionType}
      </p>
      <p style={{ color: "#666", fontSize: "14px" }}>
        Created {formatDate(manifest.createdDate)} · Updated {formatDate(manifest.updatedDate)}
        {manifest.shippedDate && <> · Shipped {formatDate(manifest.shippedDate)}</>}
        {manifest.receivedDate && <> · Received {formatDate(manifest.receivedDate)}</>}
      </p>

      <h3 style={{ color: brand.navy }}>Signatures</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
        <SignatureChecklistItem label={`Generator — ${manifest.generator.name}`} handler={manifest.generator} />
        {manifest.transporters.map((t, i) => (
          <SignatureChecklistItem
            key={i}
            label={`Transporter${t.order ? ` ${t.order}` : ""} — ${t.name}`}
            handler={t}
          />
        ))}
        <SignatureChecklistItem
          label={`Designated facility — ${manifest.designatedFacility.name}`}
          handler={manifest.designatedFacility}
        />
      </ul>

      <TransporterElapsedNote manifest={manifest} />

      <h3 style={{ color: brand.navy }}>Generator</h3>
      <p>{manifest.generator.name} ({manifest.generator.epaSiteId})</p>

      <h3 style={{ color: brand.navy }}>Transporter{manifest.transporters.length > 1 ? "s" : ""}</h3>
      <ul>
        {manifest.transporters.map((t, i) => (
          <li key={i}>
            {t.name} ({t.epaSiteId}){t.order ? ` — order ${t.order}` : ""}
          </li>
        ))}
      </ul>

      <h3 style={{ color: brand.navy }}>Designated facility</h3>
      <p>
        {manifest.designatedFacility.name} ({manifest.designatedFacility.epaSiteId})
      </p>

      <h3 style={{ color: brand.navy }}>Waste lines</h3>
      <ul>
        {manifest.wastes.map((w) => (
          <li key={w.lineNumber}>
            Line {w.lineNumber}: {w.dotInformation?.printedDotInformation ?? w.wasteDescription} —{" "}
            {w.quantity.quantity} {w.quantity.unitOfMeasurement.description ?? w.quantity.unitOfMeasurement.code}
          </li>
        ))}
      </ul>

      <LdrStatus manifest={manifest} />

      <a
        href={`/api/manifests/${manifest.manifestTrackingNumber}/attachments`}
        style={{ color: brand.blue }}
      >
        Download attachments (PDF + docs, .zip)
      </a>
      <p style={{ fontSize: "13px", color: "#888", marginTop: "2px" }}>
        Live from EPA — always current, but re-fetches from RCRAInfo every time.
      </p>

      <StoredDocumentsList manifestTrackingNumber={manifest.manifestTrackingNumber} />

      <SignManifestPanel manifest={manifest} onSigned={onSigned} />
    </Card>
  );
}

/**
 * Simple first slice of the deferred "72-hour relay timing" feature (see
 * docs/NEXT_SESSION.md item 6) -- elapsed time since the LATEST
 * transporter signature (matching the same "latest of all transporters"
 * convention as the dashboard's local mirror), color-cued against a rough
 * 48h/72h scale. Renders nothing until at least one transporter has signed.
 */
function TransporterElapsedNote({ manifest }: { manifest: Manifest }) {
  const transporterSignedAt = manifest.transporters
    .map((t) => getHandlerSignatureStatus(t).signatureDate)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  const facilitySignedAt = getHandlerSignatureStatus(manifest.designatedFacility).signatureDate ?? null;

  const info = getTransporterTimingInfo(transporterSignedAt ?? null, facilitySignedAt);
  if (!info) return null;

  return (
    <p style={{ fontSize: "13px", color: TRANSPORTER_TIMING_COLOR[info.severity], marginTop: "-8px", marginBottom: "16px" }}>
      {info.delivered ? "Delivered " : ""}
      {formatElapsedHours(info.hours)}
      {info.delivered ? " after the last transporter signature" : " since the last transporter signature — still in transit"}
    </p>
  );
}

/**
 * Land Disposal Restriction status for this manifest (40 CFR 268.7(a)) --
 * see "ldr schema.md" at the repo root. Entirely separate from EPA's
 * e-Manifest system; this only checks ManifestMate's own `ldr_notices`
 * table for an active notice matching this manifest's generator, facility,
 * and waste codes. Renders nothing if the manifest has no hazardous waste
 * codes at all -- LDR notices don't apply to a shipment with none.
 */
function LdrStatus({ manifest }: { manifest: Manifest }) {
  const [notice, setNotice] = useState<LdrNotice | null | undefined>(undefined);

  const wasteLines: LdrWasteLineEntry[] = (() => {
    const codes = new Set<string>();
    for (const w of manifest.wastes) {
      for (const c of w.hazardousWaste?.federalWasteCodes ?? []) codes.add(c.code);
    }
    // Only epaHazardousWasteNumbers actually matters here (this feeds
    // computeWasteCodeKey for the active-notice lookup, not notice
    // creation) -- manifestLineNumber/howManaged are placeholders to
    // satisfy the type.
    return codes.size > 0
      ? [{ manifestLineNumber: null, epaHazardousWasteNumbers: Array.from(codes), howManaged: "A" as const, wastewaterCategory: "nonwastewater" as const }]
      : [];
  })();

  useEffect(() => {
    if (wasteLines.length === 0) {
      setNotice(null);
      return;
    }
    findActiveLdrNoticeAction(manifest.generator.epaSiteId, manifest.designatedFacility.epaSiteId, wasteLines).then(
      setNotice
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the manifest itself (and thus its waste codes) changes
  }, [manifest.manifestTrackingNumber]);

  if (wasteLines.length === 0 || notice === undefined) return null;

  return (
    <div style={{ margin: "16px 0", padding: "10px 14px", background: brand.tint, borderRadius: "6px", fontSize: "13px" }}>
      <strong style={{ color: brand.navy }}>Land Disposal Restriction (LDR):</strong>{" "}
      {notice ? (
        <span>
          ✅ Active notice on file (prepared {notice.preparedDate}
          {notice.certifications.length > 0
            ? `, with ${notice.certifications.length} certification${notice.certifications.length > 1 ? "s" : ""}`
            : ""}
          ).{" "}
          <Link href={`/ldr/${notice.id}`} style={{ color: brand.blue }}>
            View →
          </Link>
        </span>
      ) : (
        <span>
          No LDR notice on file for this generator/facility/waste combination yet.{" "}
          <Link href={`/ldr/new?mtn=${encodeURIComponent(manifest.manifestTrackingNumber)}`} style={{ color: brand.blue }}>
            File one →
          </Link>
        </span>
      )}
    </div>
  );
}

/**
 * Documents ManifestMate has already fetched and stored (currently:
 * populated after a successful sign — see fetchAndStoreManifestDocuments
 * in manifestRepository.ts). Separate from the "Download attachments"
 * link above, which always re-fetches live from EPA — this is the
 * "repository" half: works even if EPA's attachments endpoint is slow or
 * unavailable, since it's serving ManifestMate's own stored copy.
 */
function StoredDocumentsList({ manifestTrackingNumber }: { manifestTrackingNumber: string }) {
  const [documents, setDocuments] = useState<StoredDocument[] | null>(null);

  useEffect(() => {
    setDocuments(null);
    listStoredDocumentsAction(manifestTrackingNumber).then(setDocuments);
  }, [manifestTrackingNumber]);

  if (documents === null) return null;
  if (documents.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: "#888", marginTop: "10px" }}>
        No documents stored yet — these get saved automatically the next time this manifest is signed.
      </p>
    );
  }

  return (
    <div style={{ marginTop: "10px" }}>
      <p style={{ fontWeight: 600, color: brand.navy, fontSize: "14px", marginBottom: "4px" }}>
        Stored documents
      </p>
      <ul style={{ margin: 0, paddingLeft: "20px" }}>
        {documents.map((doc) => (
          <li key={doc.filename}>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: brand.blue }}>
              {doc.filename}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * See getHandlerSignatureStatus's comment in types.ts — a handler can have
 * a placeholder electronicSignaturesInfo entry before actually signing, so
 * this deliberately doesn't just check for the array's presence.
 */
function SignatureChecklistItem({ label, handler }: { label: string; handler: Handler }) {
  const status = getHandlerSignatureStatus(handler);
  return (
    <li style={{ display: "flex", alignItems: "baseline", gap: "8px", padding: "3px 0" }}>
      <span style={{ color: status.signed ? "green" : "#bbb", fontSize: "16px" }}>
        {status.signed ? "✅" : "⬜"}
      </span>
      <span>
        {label}
        {status.signed && (
          <span style={{ color: "#666", fontSize: "13px" }}>
            {" — "}
            {status.signerName ? `signed by ${status.signerName}` : "signed"}
            {status.signatureDate ? ` on ${formatDate(status.signatureDate)}` : ""}
          </span>
        )}
      </span>
    </li>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
