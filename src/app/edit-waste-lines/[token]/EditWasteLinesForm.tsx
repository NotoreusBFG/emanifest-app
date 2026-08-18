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
import { certificationTextFor } from "@/lib/rcrainfo/certificationText";
import { CertificationDisplay } from "@/components/CertificationDisplay";

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
  // Matches /manifests/new's own seeding — the real EPA paper form's main
  // page has 4 line-item slots before a continuation sheet is needed (see
  // MAIN_PAGE_LINE_COUNT in ManifestFieldsForm.tsx).
  const [wasteLines, setWasteLines] = useState<WasteLineFormState[]>([
    emptyWasteLine(0, false),
    emptyWasteLine(1, false),
    emptyWasteLine(2, false),
    emptyWasteLine(3, false),
  ]);
  const [mmin, setMmin] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signAcknowledged, setSignAcknowledged] = useState(false);
  const certification = certificationTextFor("Generator");
  const generatorName = session.generatorName ?? "the generator";

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
      <div>
        <p style={{ color: "green", fontSize: "15px" }}>
          ✅ Saved — {state.wasteLineCount} waste line(s) added to the manifest.
        </p>
        {session.allowSign && (
          <p style={{ fontSize: "14px", color: state.signed ? "green" : "#b45309", marginTop: "8px" }}>
            {state.signed
              ? "✅ Also signed as generator."
              : `⚠️ Signing did not complete${state.signError ? ` (${state.signError})` : ""} — the waste lines are still saved, but ${generatorName} will need to sign this manifest separately.`}
          </p>
        )}
      </div>
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

      {session.allowSign && (
        <div
          style={{
            background: "#fff4e5",
            border: "1px solid #f5c576",
            borderRadius: "6px",
            padding: "12px",
            marginTop: "12px",
            fontSize: "13px",
            color: "#7a4a00",
          }}
        >
          <strong>This link also lets you sign this manifest as the generator.</strong> By completing
          this form, you&apos;ll be certifying its accuracy and signing on behalf of{" "}
          <strong>{generatorName}</strong>, using their RCRAInfo credentials — the same legal weight as
          signing it yourself. Read the certification below before continuing.
        </div>
      )}

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

        {session.allowSign && (
          <>
            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
                Your name (required to sign)
              </label>
              <input
                name="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <CertificationDisplay certification={certification} />

            <label
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "14px", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                name="signAcknowledged"
                checked={signAcknowledged}
                onChange={(e) => setSignAcknowledged(e.target.checked)}
                style={{ marginTop: "3px" }}
              />
              I have read and agree to the statement above, and I am signing on behalf of{" "}
              <strong>{generatorName}</strong>, as their authorized representative.
            </label>
          </>
        )}

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
          disabled={isPending || (session.allowSign && (!signerName.trim() || !signAcknowledged))}
          style={{
            ...primaryButtonStyle(isPending || (session.allowSign && (!signerName.trim() || !signAcknowledged))),
            marginTop: "16px",
          }}
        >
          {isPending ? "Saving…" : session.allowSign ? "Save waste lines & sign" : "Save waste lines"}
        </button>

        {state && !state.success && <p style={{ color: "red", marginTop: "10px" }}>❌ {state.error}</p>}
      </form>
    </div>
  );
}
