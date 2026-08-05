"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { attachMtnToLdrNoticeAction, type AttachMtnState } from "@/app/actions/ldrActions";
import { brandGradient } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";

/** Backfills the MTN on a third-party notice filed "unattached" -- see
 * createThirdPartyLdrNotice. router.refresh() re-runs the server
 * component so the page re-renders as attached without a full reload. */
export function AttachMtnForm({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<AttachMtnState, FormData>(
    attachMtnToLdrNoticeAction,
    null
  );

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "8px" }}
    >
      <input type="hidden" name="noticeId" value={noticeId} />
      <div>
        <label style={{ display: "block", fontSize: "12px", color: "#888", marginBottom: "4px" }}>MTN</label>
        <input name="epaMtn" required placeholder="e.g. 123456789ELC" style={{ ...inputStyle, fontSize: "13px" }} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "7px 14px",
          background: isPending ? "#ccc" : brandGradient,
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {isPending ? "Saving…" : "Attach"}
      </button>
      {state?.success === false && (
        <p style={{ color: "#c0392b", fontSize: "12px", width: "100%", margin: 0 }}>❌ {state.error}</p>
      )}
    </form>
  );
}
