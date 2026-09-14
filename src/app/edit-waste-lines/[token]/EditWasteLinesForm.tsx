"use client";

import { useActionState, useCallback, useState } from "react";
import {
  submitWasteLineEditAction,
  getFederalWasteCodesForWasteLineTokenAction,
  unlockWasteLineEditPickerDataAction,
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
import type { WasteProfile } from "@/services/wasteProfileRepository";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";

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

  // "Unlock" step: proves the delegate knows the MMIN, without doing the
  // real EPA update yet, so the owner's saved waste profiles/lab packs can
  // be shown for picking — same MMIN gate as final submit, just earlier.
  // Also carries the manifest's REAL designated-facility EPA ID (this
  // page's `facility` state otherwise only ever has the display-snapshot
  // NAME), needed for the profile/lab-pack/QR-scan facility-mismatch
  // checks in ManifestFieldsForm to work at all.
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [profiles, setProfiles] = useState<WasteProfile[]>([]);
  const [labPacks, setLabPacks] = useState<LabPack[]>([]);
  const [labPackJobs, setLabPackJobs] = useState<LabPackJob[]>([]);
  const [designatedFacilityEpaId, setDesignatedFacilityEpaId] = useState("");

  const handleUnlock = async () => {
    setUnlocking(true);
    setUnlockError(null);
    const result = await unlockWasteLineEditPickerDataAction(token, mmin);
    setUnlocking(false);
    if (!result.success) {
      setUnlockError(result.error);
      return;
    }
    setProfiles(result.profiles);
    setLabPacks(result.labPacks);
    setLabPackJobs(result.labPackJobs);
    setDesignatedFacilityEpaId(result.designatedFacilityEpaId);
    setUnlocked(true);
  };

  // The job bulk-loader normally calls listLabPacksForJobAction (owner-only,
  // session-based) — this anonymous context has no session for that, but
  // Unlock already fetched every one of the owner's unlinked drums, so just
  // filter that list client-side instead of a new server round trip.
  const loadLabPacksForJob = useCallback(
    async (jobId: string) => labPacks.filter((p) => p.jobId === jobId),
    [labPacks]
  );

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

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          border: `1px dashed ${unlocked ? "#2a8a4a" : "#888"}`,
          borderRadius: "6px",
          background: unlocked ? "#f0fbf3" : undefined,
        }}
      >
        <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>
          4-digit signing code (required)
        </label>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            name="mmin"
            form="edit-waste-lines-form"
            value={mmin}
            onChange={(e) => {
              setMmin(e.target.value);
              setUnlocked(false);
            }}
            inputMode="numeric"
            maxLength={4}
            style={{ ...inputStyle, maxWidth: "120px" }}
          />
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking || !mmin.trim()}
            style={{
              padding: "8px 16px",
              backgroundColor: "white",
              color: unlocked ? "#2a8a4a" : "#0a4b78",
              border: `1px solid ${unlocked ? "#2a8a4a" : "#0a4b78"}`,
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {unlocking ? "Checking…" : unlocked ? "✅ Unlocked" : "Unlock my saved profiles & lab packs"}
          </button>
        </div>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
          Ask whoever sent you this link for this manifest&apos;s 4-digit signing code (MMIN). Unlocking
          lets you pick from the owner&apos;s saved waste profiles and lab pack drums below instead of typing
          everything by hand — optional, you can still fill in every field manually without it.
        </p>
        {unlockError && <p style={{ color: "red", fontSize: "13px", marginTop: "4px" }}>❌ {unlockError}</p>}
      </div>

      <form id="edit-waste-lines-form" action={formAction}>
        <ManifestFieldsForm
          generator={{ ...BLANK_HANDLER, name: session.generatorName ?? "" }}
          setGenerator={() => {}}
          facility={{ ...BLANK_HANDLER, name: session.designatedFacilityName ?? "", epaSiteId: designatedFacilityEpaId }}
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
          wasteProfiles={profiles}
          labPacks={labPacks}
          labPackJobs={labPackJobs}
          onLoadLabPackJob={loadLabPacksForJob}
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
