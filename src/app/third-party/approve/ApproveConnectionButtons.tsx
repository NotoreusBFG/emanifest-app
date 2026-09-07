"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToCustomerConnectionAction } from "@/app/actions/thirdPartyApprovalActions";
import { brandGradient } from "@/lib/brandColors";

export function ApproveConnectionButtons({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (approve: boolean) => {
    setIsPending(approve ? "approve" : "decline");
    setError(null);
    const result = await respondToCustomerConnectionAction(token, approve);
    setIsPending(null);
    if (!result?.success) {
      setError(result?.success === false ? result.error : "Something went wrong.");
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={isPending !== null}
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
          {isPending === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={isPending !== null}
          style={{
            padding: "10px 20px",
            background: "white",
            color: "#c0392b",
            border: "2px solid #c0392b",
            borderRadius: "4px",
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          {isPending === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
      {error && <p style={{ color: "red", marginTop: "10px" }}>❌ {error}</p>}
    </div>
  );
}
