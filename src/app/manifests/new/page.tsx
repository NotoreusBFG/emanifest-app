"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  createManifestAction,
  getSiteDetailsAction,
  refetchManifestAction,
  type CreateManifestState,
} from "@/app/actions/manifestActions";
import { brand, brandGradient } from "@/lib/brandColors";
import { primaryButtonStyle } from "@/lib/formStyles";
import {
  ManifestFieldsForm,
  fillHandlerFromSite,
  DEFAULT_SITE,
  emptyTransporter,
  emptyWasteLine,
  type HandlerFormState,
  type TransporterFormState,
  type WasteLineFormState,
} from "./ManifestFieldsForm";
import { ImportManifestData } from "./ImportManifestData";
import { SignManifestPanel } from "../SignManifestPanel";
import { SendForSignature } from "@/components/SendForSignature";
import { getDefaultEmergencyPhoneAction } from "@/app/actions/epaActions";
import { getOnboardingProgressAction } from "@/app/actions/onboardingActions";
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from "@/lib/constants";
import type { Manifest } from "@/lib/rcrainfo/types";
import type { ImportedManifestPayload } from "@/lib/import/types";

/**
 * Every field here is controlled by React state (not `defaultValue`),
 * because React resets uncontrolled form fields after ANY Server Action
 * submission completes — success or failure. Without this, a validation
 * error wipes out everything the user typed. Controlled state is immune
 * to that reset since it lives independently of the DOM.
 */
export default function NewManifestPage() {
  const [state, formAction, isPending] = useActionState<CreateManifestState, FormData>(
    createManifestAction,
    null
  );

  const [generator, setGenerator] = useState<HandlerFormState>(DEFAULT_SITE);
  const [facility, setFacility] = useState<HandlerFormState>(DEFAULT_SITE);
  const [transporters, setTransporters] = useState<TransporterFormState[]>([emptyTransporter(0, true)]);

  // Starts at the system default (used synchronously above, before this
  // fetch can possibly resolve) and is replaced by the user's own saved
  // preference from Settings, if they have one. Also used as the fallback
  // in fillHandlerFromSite below, for sites EPA has no emergency phone on
  // file for.
  const [defaultEmergencyPhone, setDefaultEmergencyPhone] = useState(SYSTEM_DEFAULT_EMERGENCY_PHONE);

  useEffect(() => {
    getDefaultEmergencyPhoneAction().then((phone) => {
      if (!phone || phone === SYSTEM_DEFAULT_EMERGENCY_PHONE) return;
      setDefaultEmergencyPhone(phone);
      // Only overwrite generator/facility if the user hasn't already
      // edited the field away from the system default in the (brief)
      // window before this fetch resolved — don't clobber a manual edit.
      setGenerator((g) => (g.emergencyPhone === SYSTEM_DEFAULT_EMERGENCY_PHONE ? { ...g, emergencyPhone: phone } : g));
      setFacility((f) => (f.emergencyPhone === SYSTEM_DEFAULT_EMERGENCY_PHONE ? { ...f, emergencyPhone: phone } : f));
    });
  }, []);
  const [handlingInstructions, setHandlingInstructions] = useState(
    "Keep upright. Do not stack. Driver call site 30 min prior to arrival."
  );
  // 40 CFR 263.21(b)(3) — only ever applies to the *initial* transporter
  // (transporters[0]), so this is a single top-level flag, not per-row
  // state. When checked, createManifestAction writes the required
  // certifying sentence into Item 14 at save time.
  const [agencyAuthorityGranted, setAgencyAuthorityGranted] = useState(false);
  const [wasteLines, setWasteLines] = useState<WasteLineFormState[]>([
    emptyWasteLine(0, true),
    emptyWasteLine(1, false),
    emptyWasteLine(2, false),
    emptyWasteLine(3, false),
  ]);

  // "Save & sign" fetches the full saved manifest (rather than reusing the
  // form's local state) so the sign panel reflects what RCRAInfo actually
  // registered — it silently overrides submitted names/addresses with its
  // own on-file records, so the freshly-fetched copy is the accurate one.
  const [signableManifest, setSignableManifest] = useState<Manifest | null>(null);
  // Tracks the user's answer to the LDR decision prompt below, keyed by
  // MTN so it resets correctly if this page is reused for another save.
  const [ldrDecision, setLdrDecision] = useState<{ mtn: string; choice: "prepare" | "facility" } | null>(null);

  useEffect(() => {
    if (state?.success && state.intent === "sign") {
      refetchManifestAction(state.manifestTrackingNumber).then((result) => {
        if (result.success) setSignableManifest(result.manifest);
      });
    } else {
      setSignableManifest(null);
    }
  }, [state]);

  const refreshSignableManifest = async () => {
    if (!signableManifest) return;
    const result = await refetchManifestAction(signableManifest.manifestTrackingNumber);
    if (result.success) setSignableManifest(result.manifest);
  };

  /**
   * Manifest data import (docs/manifest-data-import-design.md, Option B) --
   * populates this form's existing state exactly as if a human had typed
   * it. Nothing here saves or submits anything; the user still reviews and
   * clicks Save/Save & Sign as normal. Generator/facility get a live
   * RCRAInfo lookup (same as manual site search) so imported data ends up
   * with real name/address instead of just an EPA ID; falls back to
   * whatever the import file provided if that lookup fails (e.g. not yet
   * authorized for that site).
   */
  const handleImport = async (payload: ImportedManifestPayload) => {
    const [genResult, facResult] = await Promise.all([
      getSiteDetailsAction(payload.generator.epaSiteId),
      getSiteDetailsAction(payload.designatedFacility.epaSiteId),
    ]);

    if (genResult.success) {
      setGenerator((g) => fillHandlerFromSite(genResult.site, g, defaultEmergencyPhone));
    } else {
      setGenerator((g) => ({ ...g, epaSiteId: payload.generator.epaSiteId, name: payload.generator.name ?? g.name }));
    }

    if (facResult.success) {
      setFacility((f) => fillHandlerFromSite(facResult.site, f, defaultEmergencyPhone));
    } else {
      setFacility((f) => ({
        ...f,
        epaSiteId: payload.designatedFacility.epaSiteId,
        name: payload.designatedFacility.name ?? f.name,
      }));
    }

    if (payload.transporters.length > 0) {
      setTransporters(
        payload.transporters.map((t, i) => ({ id: i, epaSiteId: t.epaSiteId, name: t.name ?? "" }))
      );
    }

    setWasteLines(
      payload.wastes.map((w, i) => ({
        id: i,
        dotHazardous: w.dotHazardous,
        isRcraWaste: w.dotHazardous,
        properShippingName: w.dotHazardous ? w.description : "",
        rqIndicator: w.rqIndicator ?? false,
        hazardClass: w.hazardClass ?? "",
        packingGroup: w.packingGroup ?? "",
        idNumberCode: w.idNumberCode ?? "",
        federalWasteCode: (w.federalWasteCodes ?? []).join(", "),
        wastewaterCategory: "nonwastewater",
        isLabPack: false,
        wasteDescription: !w.dotHazardous ? w.description : "",
        quantity: String(w.quantity),
        unitCode: w.unitCode,
        containerNumber: String(w.containerNumber),
        containerTypeCode: w.containerTypeCode,
        specialInstructions: "",
      }))
    );
  };

  // Prefills the generator from the EPA ID number captured during
  // onboarding (docs/epa-registration-wizard-design.md open question #2)
  // -- only when it's still the untouched dev default, same "don't clobber
  // a manual edit" guard as the emergency-phone effect above. Silently
  // does nothing if the user has no EPA ID saved yet, or if the lookup
  // fails (e.g. not yet authorized for that site) -- this is a convenience
  // prefill, not something that should surface an error on page load.
  useEffect(() => {
    getOnboardingProgressAction().then((progress) => {
      const epaId = progress?.epaIdNumber?.trim();
      if (!epaId) return;
      getSiteDetailsAction(epaId).then((result) => {
        if (!result.success) return;
        setGenerator((g) =>
          g.epaSiteId === DEFAULT_SITE.epaSiteId ? fillHandlerFromSite(result.site, g, defaultEmergencyPhone) : g
        );
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time prefill on mount, same pattern as the emergency-phone effect
  }, []);

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p>
        <Link href="/manifests" style={{ color: brand.blue }}>← Look up a manifest</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Create a new manifest</h1>
      <p style={{ color: "#666" }}>
        Preprod sandbox only — this saves to EPA&apos;s RCRAInfo test environment, not the live
        production e-Manifest system. Fields are pre-filled with a known-good EPA test site — edit
        as needed. Empty waste-line slots are skipped automatically, so it&apos;s fine to leave
        most of the 4 main-form slots blank; you don&apos;t need to delete unused lines. Don&apos;t
        know the waste details yet? Save with no waste lines to get a tracking number now, then use
        &quot;Add waste lines&quot; (under Send for signature, once saved) to invite someone to fill
        them in later.
      </p>

      <ImportManifestData onImport={handleImport} />

      {state && !state.success && <p style={{ color: "red" }}>❌ {state.error}</p>}
      {state && state.success && (
        <div style={{ border: "1px solid #cde9cd", borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
          <p style={{ color: "green", margin: 0 }}>
            ✅ Saved as <strong>{state.manifestTrackingNumber}</strong> —{" "}
            <Link href="/manifests" style={{ color: brand.blue }}>look it up</Link>
          </p>
          <div style={{ marginTop: "10px" }}>
            <SendForSignature mtn={state.manifestTrackingNumber} />
          </div>
          {wasteLines.some((l) => l.federalWasteCode.trim().length > 0) &&
            (ldrDecision?.mtn !== state.manifestTrackingNumber ? (
              <div
                style={{
                  marginTop: "10px",
                  padding: "12px 14px",
                  background: brand.tint,
                  borderRadius: "6px",
                  fontSize: "14px",
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: brand.navy }}>
                  This waste is subject to Land Disposal Restrictions (40 CFR 268.7). Should
                  ManifestMate prepare the LDR notice, or will the receiving facility handle a
                  separate one for this shipment?
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Link
                    href={`/ldr/new?mtn=${encodeURIComponent(state.manifestTrackingNumber)}`}
                    onClick={() => setLdrDecision({ mtn: state.manifestTrackingNumber, choice: "prepare" })}
                    style={{
                      background: brandGradient,
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontWeight: 600,
                      textDecoration: "none",
                      fontSize: "13px",
                    }}
                  >
                    Prepare LDR notice
                  </Link>
                  <button
                    type="button"
                    onClick={() => setLdrDecision({ mtn: state.manifestTrackingNumber, choice: "facility" })}
                    style={{
                      background: "none",
                      border: `1px solid ${brand.blue}`,
                      color: brand.blue,
                      padding: "6px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Facility will handle it
                  </button>
                </div>
              </div>
            ) : (
              ldrDecision.choice === "facility" && (
                <p style={{ marginTop: "10px", fontSize: "13px", color: "#666" }}>
                  Noted — the receiving facility will handle the LDR notice for this shipment.{" "}
                  <button
                    type="button"
                    onClick={() => setLdrDecision(null)}
                    style={{ background: "none", border: "none", color: brand.blue, cursor: "pointer", padding: 0, fontSize: "13px" }}
                  >
                    Changed your mind?
                  </button>
                </p>
              )
            ))}
          {state.warnings.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#946c00" }}>
                RCRAInfo warnings (data was still saved — check these weren&apos;t mistakes):
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#946c00", fontSize: "14px" }}>
                {state.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {state.intent === "sign" && (
            <div style={{ marginTop: "10px" }}>
              {signableManifest ? (
                <SignManifestPanel manifest={signableManifest} onSigned={refreshSignableManifest} />
              ) : (
                <p style={{ color: "#666", fontSize: "14px" }}>Loading sign options…</p>
              )}
            </div>
          )}
        </div>
      )}

      <form action={formAction}>
        <ManifestFieldsForm
          generator={generator}
          setGenerator={setGenerator}
          facility={facility}
          setFacility={setFacility}
          transporters={transporters}
          setTransporters={setTransporters}
          wasteLines={wasteLines}
          setWasteLines={setWasteLines}
          agencyAuthorityGranted={agencyAuthorityGranted}
          setAgencyAuthorityGranted={setAgencyAuthorityGranted}
          handlingInstructions={handlingInstructions}
          setHandlingInstructions={setHandlingInstructions}
          defaultEmergencyPhone={defaultEmergencyPhone}
        />

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={isPending}
            style={{
              padding: "10px 20px",
              backgroundColor: "white",
              color: isPending ? "#ccc" : brand.blue,
              border: `2px solid ${isPending ? "#ccc" : brand.blue}`,
              borderRadius: "4px",
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Saving..." : "Save as draft"}
          </button>
          <button
            type="submit"
            name="intent"
            value="sign"
            disabled={isPending}
            style={{ ...primaryButtonStyle(isPending), padding: "10px 20px" }}
          >
            {isPending ? "Saving..." : "Save & sign"}
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "#888", marginTop: "8px" }}>
          Both save the same way — &quot;Save & sign&quot; also shows sign options for this
          manifest right here afterward, instead of needing to look it up separately.
        </p>
      </form>
    </div>
  );
}
