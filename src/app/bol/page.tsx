"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lookupBillOfLadingByNumberAction, listRecentBillsOfLadingAction } from "@/app/actions/billOfLadingActions";
import type { RecentBillOfLading } from "@/services/billOfLadingRepository";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

/** Lookup hub for bills of lading -- same shape as /manifests (search by
 * number + a recent list), but against our own bills_of_lading table
 * instead of a live RCRAInfo call, since a BOL never leaves this app. */
export default function BillOfLadingLookupPage() {
  const router = useRouter();
  const [bolNumber, setBolNumber] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentBillOfLading[] | null>(null);

  useEffect(() => {
    listRecentBillsOfLadingAction().then(setRecent);
  }, []);

  const handleLookup = async () => {
    if (!bolNumber.trim()) return;
    setIsPending(true);
    setError(null);
    const result = await lookupBillOfLadingByNumberAction(bolNumber);
    setIsPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/bol/${result.billOfLading.id}`);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <Link href="/settings" style={{ color: brand.blue }}>← Settings</Link>
        <Link href="/bol/new" style={{ color: brand.blue }}>+ Create new</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Bill of Lading</h1>
      <p style={{ color: "#666" }}>
        Non-hazardous waste shipments only -- these are saved here in ManifestMate and never submitted
        to EPA. Look up a bill of lading by its BOL number, or start a new one.
      </p>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          value={bolNumber}
          onChange={(e) => setBolNumber(e.target.value)}
          placeholder="e.g. BOL-000001"
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        />
        <button type="button" onClick={handleLookup} disabled={isPending} style={primaryButtonStyle(isPending)}>
          {isPending ? "Looking up…" : "Look up"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>❌ {error}</p>}

      {recent && recent.length > 0 && (
        <div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: brand.navy, margin: "0 0 6px" }}>Recent</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/bol/${r.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "13px",
                    padding: "3px 0",
                    color: brand.blue,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{r.bolNumber}</span>
                  <span style={{ color: "#888", fontWeight: 400, textAlign: "right" }}>
                    {r.shipperName || "—"} → {r.consigneeName || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
