"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  createManifestAction,
  refetchManifestAction,
  type CreateManifestState,
} from "@/app/actions/manifestActions";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { SiteSearchField } from "./SiteSearchField";
import { HazmatSearchField } from "./HazmatSearchField";
import { FederalWasteCodeField } from "./FederalWasteCodeField";
import { SignManifestPanel } from "../SignManifestPanel";
import { SendSignLink } from "@/components/SendSignLink";
import { getDefaultEmergencyPhoneAction } from "@/app/actions/epaActions";
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from "@/lib/constants";
import type { Manifest, SiteSearchResultItem } from "@/lib/rcrainfo/types";
import type { HazmatEntry } from "@/lib/hazmat/types";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

const MAIN_PAGE_LINE_COUNT = 4;
const CONTINUATION_SHEET_LINE_COUNT = 7;

function continuationLabel(index: number): string {
  if (index < MAIN_PAGE_LINE_COUNT) return "main form";
  const sheetNumber = Math.ceil((index - MAIN_PAGE_LINE_COUNT + 1) / CONTINUATION_SHEET_LINE_COUNT);
  return `continuation sheet ${sheetNumber}`;
}

// EPA's real form only has 2 transporter slots (Items 6/7) — a 3rd+
// transporter goes on the continuation sheet (Items 25/26), 2 per sheet.
// Matches the same "main form vs continuation sheet" labeling pattern
// already used for waste lines above, purely for the user's mental model —
// RCRAInfo auto-paginates the generated PDF regardless.
const MAIN_PAGE_TRANSPORTER_COUNT = 2;
const CONTINUATION_SHEET_TRANSPORTER_COUNT = 2;

function transporterContinuationLabel(index: number): string {
  if (index < MAIN_PAGE_TRANSPORTER_COUNT) return "main form";
  const sheetNumber = Math.ceil(
    (index - MAIN_PAGE_TRANSPORTER_COUNT + 1) / CONTINUATION_SHEET_TRANSPORTER_COUNT
  );
  return `continuation sheet ${sheetNumber}`;
}

interface HandlerFormState {
  epaSiteId: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  emergencyPhone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
}

const DEFAULT_SITE: HandlerFormState = {
  epaSiteId: "VAD000532119",
  name: "TEST TSDF OF VA",
  firstName: "Test",
  lastName: "Contact",
  phone: "703-555-0100",
  email: "test-contact@example.com",
  emergencyPhone: SYSTEM_DEFAULT_EMERGENCY_PHONE,
  address1: "123 MAIN ST",
  city: "ARLINGTON",
  state: "VA",
  zip: "22202",
};

interface TransporterFormState {
  id: number;
  epaSiteId: string;
  name: string;
}

function emptyTransporter(id: number, prefill: boolean): TransporterFormState {
  return {
    id,
    epaSiteId: prefill ? "VATEST000001" : "",
    name: prefill ? "TEST TRANSPORTER 1 OF VA" : "",
  };
}

interface WasteLineFormState {
  id: number;
  dotHazardous: boolean;
  /**
   * A material can be DOT-hazardous without being a RCRA hazardous waste
   * (e.g. solid vs. liquid sodium hydroxide) — when checked, prefixes
   * "Waste " onto the proper shipping name in the composed DOT
   * description, matching standard manifest convention.
   */
  isRcraWaste: boolean;
  properShippingName: string;
  rqIndicator: boolean;
  hazardClass: string;
  packingGroup: string;
  idNumberCode: string;
  federalWasteCode: string;
  wasteDescription: string;
  quantity: string;
  unitCode: string;
  containerNumber: string;
  containerTypeCode: string;
  /** Prints into Box 14 (Special Handling Instructions), tagged by line number. */
  specialInstructions: string;
}

function emptyWasteLine(id: number, prefill: boolean): WasteLineFormState {
  return {
    id,
    dotHazardous: true,
    isRcraWaste: true,
    properShippingName: prefill ? "flammable liquids, n.o.s. (contains xylene)" : "",
    rqIndicator: prefill,
    hazardClass: prefill ? "3" : "",
    packingGroup: prefill ? "II" : "",
    idNumberCode: prefill ? "UN1993" : "",
    federalWasteCode: prefill ? "D001" : "",
    wasteDescription: "",
    quantity: prefill ? "1" : "",
    unitCode: prefill ? "P" : "",
    containerNumber: prefill ? "1" : "",
    containerTypeCode: prefill ? "DM" : "",
    specialInstructions: "",
  };
}

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

  useEffect(() => {
    if (state?.success && state.intent === "sign") {
      refetchManifestAction(state.manifestTrackingNumber).then((result) => {
        if (result.success) setSignableManifest(result.manifest);
      });
    } else {
      setSignableManifest(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when a new save result comes in, not on every render
  }, [state]);

  const refreshSignableManifest = async () => {
    if (!signableManifest) return;
    const result = await refetchManifestAction(signableManifest.manifestTrackingNumber);
    if (result.success) setSignableManifest(result.manifest);
  };

  const updateTransporter = (id: number, patch: Partial<TransporterFormState>) =>
    setTransporters((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const fillTransporterFromSite = (id: number, site: SiteSearchResultItem) =>
    updateTransporter(id, { epaSiteId: site.epaSiteId, name: site.name });

  const addTransporter = () => {
    const nextId = transporters.length ? Math.max(...transporters.map((t) => t.id)) + 1 : 0;
    setTransporters((list) => [...list, emptyTransporter(nextId, false)]);
  };

  const removeTransporter = (id: number) => {
    setTransporters((list) => (list.length > 1 ? list.filter((t) => t.id !== id) : list));
  };

  /**
   * Generator and designated facility share the same form shape
   * (`HandlerFormState`) and the same fill logic — EPA's registered
   * contact (name/address/phone/email/emergency phone) overwrites
   * whatever placeholder was there before, since leaving it unfilled
   * previously let default test-site data silently end up on printed
   * manifests.
   */
  const fillHandlerFromSite = (site: SiteSearchResultItem, current: HandlerFormState): HandlerFormState => ({
    ...current,
    epaSiteId: site.epaSiteId,
    name: site.name,
    // Falls back to "" (not the previous value) when EPA's record doesn't
    // have a given field — some registered sites are missing phone/contact
    // data. Falling back to whatever was there before silently left stale
    // placeholder data in place (e.g. a disposal facility showing the
    // previous site's phone number), which looks legitimate but is wrong.
    // An empty field is an honest signal that this one needs manual entry.
    address1: site.siteAddress?.address1 ?? "",
    city: site.siteAddress?.city ?? "",
    state: site.siteAddress?.state?.code ?? "",
    zip: site.siteAddress?.zip ?? "",
    firstName: site.contact?.firstName ?? "",
    lastName: site.contact?.lastName ?? "",
    phone: site.contact?.phoneNumber?.number ?? "",
    email: site.contact?.email ?? "",
    // Unlike the fields above, an empty emergency phone isn't a useful
    // "please fill this in" signal — it's a required field with a sensible
    // system/user-configured default, so fall back to that instead of "".
    emergencyPhone: site.emergencyPhone?.number ?? defaultEmergencyPhone,
  });

  const fillGeneratorFromSite = (site: SiteSearchResultItem) =>
    setGenerator((g) => fillHandlerFromSite(site, g));

  const fillFacilityFromSite = (site: SiteSearchResultItem) =>
    setFacility((f) => fillHandlerFromSite(site, f));

  const updateWasteLine = (id: number, patch: Partial<WasteLineFormState>) =>
    setWasteLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const fillWasteLineFromHazmat = (id: number, entry: HazmatEntry) => {
    // A few §172.101 entries (e.g. "Hazardous waste, liquid, n.o.s.",
    // "Hazardous waste, solid, n.o.s.") already have "waste" baked into
    // their official shipping name — checking "RCRA waste" on top of one
    // of these would double it up ("Waste Hazardous waste, liquid,
    // n.o.s."), so force it off for exactly these entries rather than
    // leaving that footgun for the user to notice manually.
    const nameAlreadyIncludesWaste = /\bwaste\b/i.test(entry.properShippingName);
    updateWasteLine(id, {
      properShippingName: entry.properShippingName,
      hazardClass: entry.hazardClass,
      packingGroup: entry.packingGroup,
      idNumberCode: entry.idNumbers,
      ...(nameAlreadyIncludesWaste ? { isRcraWaste: false } : {}),
    });
  };

  const addContinuationPage = () => {
    const nextId = wasteLines.length ? Math.max(...wasteLines.map((l) => l.id)) + 1 : 0;
    const newLines = Array.from({ length: CONTINUATION_SHEET_LINE_COUNT }, (_, i) =>
      emptyWasteLine(nextId + i, false)
    );
    setWasteLines((lines) => [...lines, ...newLines]);
  };

  const removeWasteLine = (id: number) => {
    setWasteLines((lines) => (lines.length > 1 ? lines.filter((l) => l.id !== id) : lines));
  };

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
        most of the 4 main-form slots blank; you don&apos;t need to delete unused lines.
      </p>

      {state && !state.success && <p style={{ color: "red" }}>❌ {state.error}</p>}
      {state && state.success && (
        <div style={{ border: "1px solid #cde9cd", borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
          <p style={{ color: "green", margin: 0 }}>
            ✅ Saved as <strong>{state.manifestTrackingNumber}</strong> —{" "}
            <Link href="/manifests" style={{ color: brand.blue }}>look it up</Link>
          </p>
          <div style={{ marginTop: "10px" }}>
            <SendSignLink mtn={state.manifestTrackingNumber} />
          </div>
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
        <input
          type="hidden"
          name="wasteLineIds"
          value={wasteLines.map((l) => l.id).join(",")}
        />
        <input
          type="hidden"
          name="transporterIds"
          value={transporters.map((t) => t.id).join(",")}
        />

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>Generator</legend>
          <SiteSearchField
            siteType="Generator"
            placeholder="Search registered generators by name…"
            onSelect={fillGeneratorFromSite}
          />
          <div style={row}>
            <div style={field}>
              <label style={label}>EPA Site ID</label>
              <input
                name="generatorEpaSiteId"
                required
                value={generator.epaSiteId}
                onChange={(e) => setGenerator((g) => ({ ...g, epaSiteId: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Name</label>
              <input
                name="generatorName"
                required
                value={generator.name}
                onChange={(e) => setGenerator((g) => ({ ...g, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact first name</label>
              <input
                name="generatorFirstName"
                required
                value={generator.firstName}
                onChange={(e) => setGenerator((g) => ({ ...g, firstName: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Contact last name</label>
              <input
                name="generatorLastName"
                required
                value={generator.lastName}
                onChange={(e) => setGenerator((g) => ({ ...g, lastName: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact phone</label>
              <input
                name="generatorPhone"
                required
                value={generator.phone}
                onChange={(e) => setGenerator((g) => ({ ...g, phone: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Contact email</label>
              <input
                name="generatorEmail"
                type="email"
                value={generator.email}
                onChange={(e) => setGenerator((g) => ({ ...g, email: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Emergency phone</label>
              <input
                name="generatorEmergencyPhone"
                required
                value={generator.emergencyPhone}
                onChange={(e) => setGenerator((g) => ({ ...g, emergencyPhone: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={{ ...field, flex: 2 }}>
              <label style={label}>Address</label>
              <input
                name="generatorAddress1"
                required
                value={generator.address1}
                onChange={(e) => setGenerator((g) => ({ ...g, address1: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>City</label>
              <input
                name="generatorCity"
                required
                value={generator.city}
                onChange={(e) => setGenerator((g) => ({ ...g, city: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ ...field, flex: 0.5 }}>
              <label style={label}>State</label>
              <input
                name="generatorState"
                required
                value={generator.state}
                onChange={(e) => setGenerator((g) => ({ ...g, state: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ ...field, flex: 0.7 }}>
              <label style={label}>Zip</label>
              <input
                name="generatorZip"
                required
                value={generator.zip}
                onChange={(e) => setGenerator((g) => ({ ...g, zip: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
        </fieldset>

        {transporters.map((t, index) => (
          <fieldset
            key={t.id}
            style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}
          >
            <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>
              Transporter {index + 1} ({transporterContinuationLabel(index)})
            </legend>
            <SiteSearchField
              siteType="Transporter"
              placeholder="Search registered transporters by name…"
              onSelect={(site) => fillTransporterFromSite(t.id, site)}
            />
            <div style={row}>
              <div style={field}>
                <label style={label}>EPA Site ID</label>
                <input
                  name={`transporterEpaSiteId_${t.id}`}
                  required
                  value={t.epaSiteId}
                  onChange={(e) => updateTransporter(t.id, { epaSiteId: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Name</label>
                <input
                  name={`transporterName_${t.id}`}
                  required
                  value={t.name}
                  onChange={(e) => updateTransporter(t.id, { name: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            {transporters.length > 1 && (
              <button
                type="button"
                onClick={() => removeTransporter(t.id)}
                style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", padding: 0 }}
              >
                Remove this transporter
              </button>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          onClick={addTransporter}
          style={{
            marginBottom: "20px",
            padding: "8px 16px",
            backgroundColor: "white",
            color: brand.blue,
            border: `1px solid ${brand.blue}`,
            borderRadius: "4px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add another transporter
        </button>

        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>Designated facility</legend>
          <SiteSearchField
            siteType="Tsdf"
            placeholder="Search registered disposal facilities by name…"
            onSelect={fillFacilityFromSite}
          />
          <div style={row}>
            <div style={field}>
              <label style={label}>EPA Site ID</label>
              <input
                name="facilityEpaSiteId"
                required
                value={facility.epaSiteId}
                onChange={(e) => setFacility((f) => ({ ...f, epaSiteId: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Name</label>
              <input
                name="facilityName"
                required
                value={facility.name}
                onChange={(e) => setFacility((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact first name</label>
              <input
                name="facilityFirstName"
                required
                value={facility.firstName}
                onChange={(e) => setFacility((f) => ({ ...f, firstName: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Contact last name</label>
              <input
                name="facilityLastName"
                required
                value={facility.lastName}
                onChange={(e) => setFacility((f) => ({ ...f, lastName: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Contact phone</label>
              <input
                name="facilityPhone"
                required
                value={facility.phone}
                onChange={(e) => setFacility((f) => ({ ...f, phone: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Contact email</label>
              <input
                name="facilityEmail"
                type="email"
                value={facility.email}
                onChange={(e) => setFacility((f) => ({ ...f, email: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>Emergency phone</label>
              <input
                name="facilityEmergencyPhone"
                required
                value={facility.emergencyPhone}
                onChange={(e) => setFacility((f) => ({ ...f, emergencyPhone: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={row}>
            <div style={{ ...field, flex: 2 }}>
              <label style={label}>Address</label>
              <input
                name="facilityAddress1"
                required
                value={facility.address1}
                onChange={(e) => setFacility((f) => ({ ...f, address1: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={field}>
              <label style={label}>City</label>
              <input
                name="facilityCity"
                required
                value={facility.city}
                onChange={(e) => setFacility((f) => ({ ...f, city: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ ...field, flex: 0.5 }}>
              <label style={label}>State</label>
              <input
                name="facilityState"
                required
                value={facility.state}
                onChange={(e) => setFacility((f) => ({ ...f, state: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ ...field, flex: 0.7 }}>
              <label style={label}>Zip</label>
              <input
                name="facilityZip"
                required
                value={facility.zip}
                onChange={(e) => setFacility((f) => ({ ...f, zip: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
        </fieldset>

        {wasteLines.map((line, index) => (
          <fieldset
            key={line.id}
            style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}
          >
            <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>
              Waste line {index + 1} ({continuationLabel(index)})
            </legend>

            <div style={row}>
              <div style={{ ...field, flex: 0.6 }}>
                <label style={label}>
                  <input
                    name={`dotHazardous_${line.id}`}
                    type="checkbox"
                    checked={line.dotHazardous}
                    onChange={(e) => updateWasteLine(line.id, { dotHazardous: e.target.checked })}
                    style={{ marginRight: "6px" }}
                  />
                  HM (DOT hazardous material)
                </label>
              </div>
              <div style={{ ...field, flex: 0.6 }}>
                <label style={{ ...label, opacity: line.dotHazardous ? 1 : 0.5 }}>
                  <input
                    name={`isRcraWaste_${line.id}`}
                    type="checkbox"
                    checked={line.isRcraWaste}
                    disabled={!line.dotHazardous}
                    onChange={(e) => updateWasteLine(line.id, { isRcraWaste: e.target.checked })}
                    style={{ marginRight: "6px" }}
                  />
                  RCRA waste (prints &quot;Waste&quot;)
                </label>
              </div>
              <div style={field}>
                <label style={label}>
                  Special instructions for this line (optional — prints into Box 14)
                </label>
                <input
                  name={`specialInstructions_${line.id}`}
                  value={line.specialInstructions}
                  onChange={(e) => updateWasteLine(line.id, { specialInstructions: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {line.dotHazardous ? (
              <>
                <HazmatSearchField
                  placeholder="Search DOT hazardous materials table by shipping name…"
                  onSelect={(entry) => fillWasteLineFromHazmat(line.id, entry)}
                />
                <div style={field}>
                  <label style={label}>Proper shipping name</label>
                  <textarea
                    name={`properShippingName_${line.id}`}
                    rows={2}
                    value={line.properShippingName}
                    onChange={(e) => updateWasteLine(line.id, { properShippingName: e.target.value })}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
                <div style={row}>
                  <div style={field}>
                    <label style={label}>
                      <input
                        name={`rqIndicator_${line.id}`}
                        type="checkbox"
                        checked={line.rqIndicator}
                        onChange={(e) => updateWasteLine(line.id, { rqIndicator: e.target.checked })}
                        style={{ marginRight: "6px" }}
                      />
                      RQ (reportable quantity)
                    </label>
                  </div>
                  <div style={field}>
                    <label style={label}>Hazard class</label>
                    <input
                      name={`hazardClass_${line.id}`}
                      value={line.hazardClass}
                      onChange={(e) => updateWasteLine(line.id, { hazardClass: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div style={field}>
                    <label style={label}>Packing group</label>
                    <input
                      name={`packingGroup_${line.id}`}
                      value={line.packingGroup}
                      onChange={(e) => updateWasteLine(line.id, { packingGroup: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={row}>
                  <div style={field}>
                    <label style={label}>
                      DOT ID number code (from search above — search by ID number too, e.g.
                      &quot;UN1993&quot;)
                    </label>
                    <input
                      name={`idNumberCode_${line.id}`}
                      value={line.idNumberCode}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                    />
                  </div>
                  <div style={field}>
                    <label style={label}>Federal waste codes (optional)</label>
                    <FederalWasteCodeField
                      name={`federalWasteCode_${line.id}`}
                      value={line.federalWasteCode}
                      onChange={(v) => updateWasteLine(line.id, { federalWasteCode: v })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div style={field}>
                <label style={label}>Waste description</label>
                <input
                  name={`wasteDescription_${line.id}`}
                  value={line.wasteDescription}
                  onChange={(e) => updateWasteLine(line.id, { wasteDescription: e.target.value })}
                  style={inputStyle}
                />
              </div>
            )}

            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 8px" }}>
              Quantity, unit, container count, and container type are all required once this
              line has a description.
            </p>
            <div style={row}>
              <div style={field}>
                <label style={label}>Quantity</label>
                <input
                  name={`quantity_${line.id}`}
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateWasteLine(line.id, { quantity: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Unit code</label>
                <input
                  name={`unitCode_${line.id}`}
                  value={line.unitCode}
                  onChange={(e) => updateWasteLine(line.id, { unitCode: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Container count</label>
                <input
                  name={`containerNumber_${line.id}`}
                  type="number"
                  value={line.containerNumber}
                  onChange={(e) => updateWasteLine(line.id, { containerNumber: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={field}>
                <label style={label}>Container type code</label>
                <input
                  name={`containerTypeCode_${line.id}`}
                  value={line.containerTypeCode}
                  onChange={(e) => updateWasteLine(line.id, { containerTypeCode: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {wasteLines.length > 1 && (
              <button
                type="button"
                onClick={() => removeWasteLine(line.id)}
                style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", padding: 0 }}
              >
                Remove this waste line
              </button>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          onClick={addContinuationPage}
          style={{
            marginBottom: "20px",
            padding: "8px 16px",
            backgroundColor: "white",
            color: brand.blue,
            border: `1px solid ${brand.blue}`,
            borderRadius: "4px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add continuation page ({CONTINUATION_SHEET_LINE_COUNT} more lines)
        </button>

        <div style={{ marginBottom: "20px" }}>
          <label style={label}>
            Special handling instructions (optional — Box 14. RCRAInfo prints this, plus any
            per-line notes, all on page 1 regardless of which page the line is on — there&apos;s
            no separate box per continuation sheet.)
          </label>
          <textarea
            name="handlingInstructions"
            rows={3}
            value={handlingInstructions}
            onChange={(e) => setHandlingInstructions(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

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
