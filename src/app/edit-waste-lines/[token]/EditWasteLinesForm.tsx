"use client";

import { useActionState, useCallback, useState } from "react";
import {
  submitWasteLineEditAction,
  getFederalWasteCodesForWasteLineTokenAction,
  type SubmitWasteLineEditState,
} from "@/app/actions/wasteLineEditActions";
import type { WasteLineEditSession } from "@/services/wasteLineEditRepository";
import {
  ManifestFieldsForm,
  BLANK_HANDLER,
  emptyWasteLine,
  type WasteLineFormState,
} from "@/app/manifests/new/ManifestFieldsForm";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";

/**
 * No-account waste-line-only editor for a delegate. Generator/transporter/
 * designated-facility are never shown as editable here — ManifestFieldsForm's
 * mode="wasteLinesOnly" renders them read-only from whatever this page
 * knows (just names, from the token's display snapshot — no live fetch
 * happens until AFTER a correct MMIN is submitted, see
 * submitWasteLineEditAction). One form, one submit: waste lines + the
 * MMIN go together in a single call, applying directly to EPA — no
 * separate owner-review step (confirmed with user).
 */
export function EditWasteLinesForm({ token, session }: { token: string; session: WasteLineEditSession }) {
  const [wasteLines, setWasteLines] = useState<WasteLineFormState[]>([emptyWasteLine(0, false)]);
  const [mmin, setMmin] = useState("");

  const boundAction = useCallback(
    (prevState: SubmitWasteLineEditState, formData: FormData) => submitWasteLineEditAction(token, prevState, formData),
    [token]
  );
  const [state, formAction, isPending] = useActionState<SubmitWasteLineEditState, FormData>(boundAction, null);

  // Not token-scoped — see getFederalWasteCodesForWasteLineTokenAction's
  // own comment for why this must work before the token is ever claimed.
  const federalWasteCodesFn = useCallback(() => getFederalWasteCodesForWasteLineTokenAction(), []);

  if (state?.success) {
    return (
      <p style={{ color: "green", fontSize: "15px" }}>
        ✅ Saved — {state.wasteLineCount} waste line(s) added to the manifest.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: "14px", color: "#333" }}>
        Add waste line details to manifest <strong>{session.epaMtn}</strong>
        {session.generatorName && (
          <>
            {" "}
            for <strong>{session.generatorName}</strong>
          </>
        )}
        {session.designatedFacilityName && (
          <>
            {" "}
            → <strong>{session.designatedFacilityName}</strong>
          </>
        )}
        . The generator, transporter, and disposal facility on this manifest can&apos;t be changed
        here.
      </p>

      <form action={formAction}>
        <ManifestFieldsForm
          generator={{ ...BLANK_HANDLER, name: session.generatorName ?? "" }}
          setGenerator={() => {}}
          facility={{ ...BLANK_HANDLER, name: session.designatedFacilityName ?? "" }}
          setFacility={() => {}}
          transporters={[]}
          setTransporters={() => {}}
          wasteLines={wasteLines}
          setWasteLines={setWasteLines}
          agencyAuthorityGranted={false}
          setAgencyAuthorityGranted={() => {}}
          handlingInstructions=""
          setHandlingInstructions={() => {}}
          defaultEmergencyPhone=""
          federalWasteCodesFn={federalWasteCodesFn}
          mode="wasteLinesOnly"
        />

        <div style={{ marginTop: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
            4-digit signing code (required)
          </label>
          <input
            name="mmin"
            value={mmin}
            onChange={(e) => setMmin(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            style={inputStyle}
          />
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
            Ask whoever sent you this link for this manifest&apos;s 4-digit signing code (MMIN).
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          style={{ ...primaryButtonStyle(isPending), marginTop: "16px" }}
        >
          {isPending ? "Saving…" : "Save waste lines"}
        </button>

        {state && !state.success && <p style={{ color: "red", marginTop: "10px" }}>❌ {state.error}</p>}
      </form>
    </div>
  );
}
