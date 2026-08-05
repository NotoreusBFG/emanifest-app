"use client";

import { Suspense, useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createThirdPartyLdrNoticeAction, type CreateThirdPartyLdrNoticeState } from "@/app/actions/ldrActions";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

// useSearchParams() (for the ?mtn= prefill deep link) requires a Suspense
// boundary in the App Router, same reason /ldr/new/prepared wraps itself.
export default function NewThirdPartyLdrNoticePage() {
  return (
    <Suspense fallback={null}>
      <NewThirdPartyLdrNoticePageInner />
    </Suspense>
  );
}

function NewThirdPartyLdrNoticePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mtnFromQuery = searchParams.get("mtn") ?? "";

  const [state, formAction, isPending] = useActionState<CreateThirdPartyLdrNoticeState | null, FormData>(
    createThirdPartyLdrNoticeAction,
    null
  );

  // Once the row exists, hand off to the detail page -- that's where the
  // actual PDF gets attached, via the same AttachmentsSection used on
  // every LDR notice.
  useEffect(() => {
    if (state?.success) router.push(`/ldr/${state.notice.id}`);
  }, [state, router]);

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <p>
        <Link href="/ldr/new" style={{ color: brand.blue }}>
          ← Back
        </Link>
      </p>
      <h1 style={{ color: brand.navy }}>Upload a notice I already have</h1>
      <p style={{ color: "#666" }}>
        Record who sent this LDR notice and which shipment it belongs to, then attach the PDF on
        the next screen. ManifestMate isn&apos;t generating or certifying anything here — it&apos;s
        just keeping the document on file with the shipment for you.
      </p>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            Who prepared or sent this notice?
          </label>
          <input
            name="thirdPartyName"
            required
            placeholder="e.g. Acme Environmental Labs"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            Manifest tracking number (MTN)
          </label>
          <input name="epaMtn" defaultValue={mtnFromQuery} placeholder="e.g. 123456789ELC" style={inputStyle} />
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#888" }}>
            Optional — leave blank if you don&apos;t have it yet and add it later from the notice
            page. ManifestMate doesn&apos;t check this notice against the shipment; confirming they
            match is on you as the signer.
          </p>
        </div>

        <button type="submit" disabled={isPending} style={primaryButtonStyle(isPending)}>
          {isPending ? "Saving…" : "Continue to upload PDF"}
        </button>

        {state?.success === false && <p style={{ color: "#c0392b", fontSize: "13px" }}>❌ {state.error}</p>}
      </form>
    </div>
  );
}
