"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  lookupManifestAction,
  refetchManifestAction,
  type LookupManifestState,
} from "@/app/actions/manifestActions";
import type { Manifest } from "@/lib/rcrainfo/types";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { SignManifestPanel } from "./SignManifestPanel";

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
    <div style={{ border: `1px solid ${brand.tint}`, borderRadius: "6px", padding: "20px", backgroundColor: "#fff" }}>
      <h2 style={{ marginTop: 0, color: brand.navy }}>{manifest.manifestTrackingNumber}</h2>
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

      <a
        href={`/api/manifests/${manifest.manifestTrackingNumber}/attachments`}
        style={{ color: brand.blue }}
      >
        Download attachments (PDF + docs, .zip)
      </a>

      <SignManifestPanel manifest={manifest} onSigned={onSigned} />
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
