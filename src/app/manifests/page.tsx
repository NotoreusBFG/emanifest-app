"use client";

import { useActionState } from "react";
import Link from "next/link";
import { lookupManifestAction, type LookupManifestState } from "@/app/actions/manifestActions";
import type { Manifest } from "@/lib/rcrainfo/types";

const inputStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};

export default function ManifestLookupPage() {
  const [state, formAction, isPending] = useActionState<LookupManifestState, FormData>(
    lookupManifestAction,
    null
  );

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>
        <Link href="/settings" style={{ color: "#0070f3" }}>← Settings</Link>
      </p>
      <h1>Look up a manifest</h1>
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
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "8px 16px",
            backgroundColor: isPending ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? "Looking up..." : "Look up"}
        </button>
      </form>

      {state && !state.success && (
        <p style={{ color: "red" }}>❌ {state.error}</p>
      )}

      {state && state.success && (
        <ManifestSummary manifest={state.manifest} />
      )}
    </div>
  );
}

function ManifestSummary({ manifest }: { manifest: Manifest }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "20px" }}>
      <h2 style={{ marginTop: 0 }}>{manifest.manifestTrackingNumber}</h2>
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

      <h3>Generator</h3>
      <p>{manifest.generator.name} ({manifest.generator.epaSiteId})</p>

      <h3>Transporter{manifest.transporters.length > 1 ? "s" : ""}</h3>
      <ul>
        {manifest.transporters.map((t, i) => (
          <li key={i}>
            {t.name} ({t.epaSiteId}){t.order ? ` — order ${t.order}` : ""}
          </li>
        ))}
      </ul>

      <h3>Designated facility</h3>
      <p>
        {manifest.designatedFacility.name} ({manifest.designatedFacility.epaSiteId})
      </p>

      <h3>Waste lines</h3>
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
        style={{ color: "#0070f3" }}
      >
        Download attachments (PDF + docs, .zip)
      </a>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
