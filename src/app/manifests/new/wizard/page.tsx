"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  createManifestAction,
  getSiteDetailsAction,
  refetchManifestAction,
  type CreateManifestState,
} from "@/app/actions/manifestActions";
import { isManifestWizardEnabledForMeAction } from "@/app/actions/manifestWizardActions";
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
} from "../ManifestFieldsForm";
import { ImportManifestData } from "../ImportManifestData";
import { PrintLabelsPanel } from "../PrintLabelsPanel";
import { SignManifestPanel } from "../../SignManifestPanel";
import { SendForSignature } from "@/components/SendForSignature";
import { getDefaultEmergencyPhoneAction } from "@/app/actions/epaActions";
import { getOnboardingProgressAction } from "@/app/actions/onboardingActions";
import { getMyAccountTypeAction } from "@/app/actions/accountActions";
import { listWasteProfilesForUserAction } from "@/app/actions/wasteProfileActions";
import { listLabPacksForUserAction, listLabPackJobsForUserAction } from "@/app/actions/labPackActions";
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from "@/lib/constants";
import type { Manifest } from "@/lib/rcrainfo/types";
import type { ImportedManifestPayload } from "@/lib/import/types";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";
import { GeneratorStepModal } from "./GeneratorStepModal";
import { TransporterStepModal } from "./TransporterStepModal";
import { FacilityStepModal } from "./FacilityStepModal";
import { WasteLineStepModal } from "./WasteLineStepModal";

type WizardStep =
  | { kind: "generator" }
  | { kind: "transporter" }
  | { kind: "facility" }
  | { kind: "wasteLine"; index: number }
  | { kind: "review" };

/**
 * Guided setup for /manifests/new -- the client's own request was a series
 * of pop-up windows (Generator, then Transporter, then Designated
 * facility, then one waste line at a time), pure manual UI with no AI
 * involvement. Rather than re-implement submission, this page runs the
 * exact same state/effects/useActionState NewManifestPage does (copied,
 * not imported, since that page has no separate exported "body" component)
 * and once the walkthrough reaches "review", renders the exact same
 * ManifestFieldsForm + Save/Save & Sign buttons that page uses -- so the
 * actual submission path is byte-identical to /manifests/new's, and this
 * page can never drift from that page's own business logic.
 */
function WizardBody() {
  const [state, formAction, isPending] = useActionState<CreateManifestState, FormData>(
    createManifestAction,
    null
  );

  const [step, setStep] = useState<WizardStep>({ kind: "generator" });

  const [generator, setGenerator] = useState<HandlerFormState>(DEFAULT_SITE);
  const [facility, setFacility] = useState<HandlerFormState>(DEFAULT_SITE);
  const [transporters, setTransporters] = useState<TransporterFormState[]>([emptyTransporter(0, true)]);

  const [defaultEmergencyPhone, setDefaultEmergencyPhone] = useState(SYSTEM_DEFAULT_EMERGENCY_PHONE);

  const [wasteProfiles, setWasteProfiles] = useState<WasteProfile[]>([]);
  useEffect(() => {
    listWasteProfilesForUserAction().then(setWasteProfiles);
  }, []);

  const [labPacks, setLabPacks] = useState<LabPack[]>([]);
  useEffect(() => {
    listLabPacksForUserAction().then((packs) => setLabPacks(packs.filter((p) => !p.epaMtn)));
  }, []);

  const [labPackJobs, setLabPackJobs] = useState<LabPackJob[]>([]);
  useEffect(() => {
    listLabPackJobsForUserAction().then((jobs) => setLabPackJobs(jobs.filter((j) => j.status !== "linked")));
  }, []);

  const [accountType, setAccountType] = useState<string | null>(null);
  useEffect(() => {
    getMyAccountTypeAction().then(setAccountType);
  }, []);

  useEffect(() => {
    getDefaultEmergencyPhoneAction().then((phone) => {
      if (!phone || phone === SYSTEM_DEFAULT_EMERGENCY_PHONE) return;
      setDefaultEmergencyPhone(phone);
      setGenerator((g) => (g.emergencyPhone === SYSTEM_DEFAULT_EMERGENCY_PHONE ? { ...g, emergencyPhone: phone } : g));
      setFacility((f) => (f.emergencyPhone === SYSTEM_DEFAULT_EMERGENCY_PHONE ? { ...f, emergencyPhone: phone } : f));
    });
  }, []);

  const [handlingInstructions, setHandlingInstructions] = useState(
    "Keep upright. Do not stack. Driver call site 30 min prior to arrival."
  );
  const [agencyAuthorityGranted, setAgencyAuthorityGranted] = useState(false);

  // Starts with a single line -- the whole point of the guided flow is
  // "one waste line at a time, then ask to save or add another" (the
  // client's own words), unlike /manifests/new's own 4-blank-slot default.
  const [wasteLines, setWasteLines] = useState<WasteLineFormState[]>([emptyWasteLine(0, true)]);

  const [signableManifest, setSignableManifest] = useState<Manifest | null>(null);
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
        ergEnabled: false,
        ergNumber: "",
        wastewaterCategory: "nonwastewater",
        isLabPack: false,
        labPackId: null,
        wasteDescription: !w.dotHazardous ? w.description : "",
        quantity: String(w.quantity),
        unitCode: w.unitCode,
        containerNumber: String(w.containerNumber),
        containerTypeCode: w.containerTypeCode,
        specialInstructions: "",
        scanGroupKey: null,
      }))
    );
  };

  useEffect(() => {
    if (accountType === "generator" || accountType === "third_party") return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs once accountType resolves, then this is a one-time prefill
  }, [accountType]);

  const generatorSelectSource =
    accountType === "generator" ? "managed" : accountType === "third_party" ? "customers" : undefined;

  const exitToReview = () => setStep({ kind: "review" });

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <Link href="/manifests/new" style={{ color: brand.blue }}>← Skip guided setup</Link>
        <Link href="/profiles" style={{ color: brand.blue }}>Manage waste profiles →</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Create a new manifest — guided setup</h1>

      {step.kind === "generator" && (
        <GeneratorStepModal
          generator={generator}
          setGenerator={setGenerator}
          defaultEmergencyPhone={defaultEmergencyPhone}
          generatorSelectSource={generatorSelectSource}
          onNext={() => setStep({ kind: "transporter" })}
          onClose={exitToReview}
        />
      )}
      {step.kind === "transporter" && (
        <TransporterStepModal
          transporters={transporters}
          setTransporters={setTransporters}
          onNext={() => setStep({ kind: "facility" })}
          onBack={() => setStep({ kind: "generator" })}
          onClose={exitToReview}
        />
      )}
      {step.kind === "facility" && (
        <FacilityStepModal
          facility={facility}
          setFacility={setFacility}
          defaultEmergencyPhone={defaultEmergencyPhone}
          onNext={() => setStep({ kind: "wasteLine", index: 0 })}
          onBack={() => setStep({ kind: "transporter" })}
          onClose={exitToReview}
        />
      )}
      {step.kind === "wasteLine" && (
        <WasteLineStepModal
          wasteLines={wasteLines}
          setWasteLines={setWasteLines}
          currentIndex={step.index}
          onSaveAndAddAnother={() => setStep({ kind: "wasteLine", index: step.index + 1 })}
          onDone={exitToReview}
          onBack={() =>
            step.index > 0 ? setStep({ kind: "wasteLine", index: step.index - 1 }) : setStep({ kind: "facility" })
          }
          onClose={exitToReview}
        />
      )}

      {step.kind === "review" && (
        <>
          <p style={{ color: "#666" }}>
            Preprod sandbox only — this saves to EPA&apos;s RCRAInfo test environment, not the live
            production e-Manifest system. Review everything the guided setup filled in below, edit
            anything you like, then save.
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
              <PrintLabelsPanel
                wasteLines={wasteLines}
                generator={generator}
                facility={facility}
                manifestTrackingNumber={state.manifestTrackingNumber}
              />
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
              wasteProfiles={wasteProfiles}
              labPacks={labPacks}
              labPackJobs={labPackJobs}
              generatorSelectSource={generatorSelectSource}
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
          </form>
        </>
      )}
    </div>
  );
}

export default function ManifestWizardPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    isManifestWizardEnabledForMeAction().then(setEnabled);
  }, []);

  if (enabled === null) return null;
  if (!enabled) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm text-gray-600">
            Guided setup isn&apos;t enabled for your account yet.{" "}
            <Link href="/manifests/new" className="text-brand-blue underline">
              Create a manifest the regular way
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return <WizardBody />;
}
