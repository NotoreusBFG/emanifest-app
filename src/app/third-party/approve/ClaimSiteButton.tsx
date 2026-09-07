"use client";

import { useActionState } from "react";
import Link from "next/link";
import { claimApprovedSiteAction } from "@/app/actions/thirdPartyApprovalActions";
import { brand, brandGradient } from "@/lib/brandColors";

export function ClaimSiteButton({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(claimApprovedSiteAction, null);

  if (state?.success) {
    return (
      <div>
        <p style={{ color: "green" }}>✅ {state.message}</p>
        <Link href="/settings" style={{ color: brand.blue, fontWeight: 600 }}>
          Go to Settings →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "10px 20px",
          background: isPending ? "#ccc" : brandGradient,
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Adding…" : "Add this site to my account"}
      </button>
      {state?.success === false && <p style={{ color: "red", marginTop: "10px" }}>❌ {state.error}</p>}
    </form>
  );
}
