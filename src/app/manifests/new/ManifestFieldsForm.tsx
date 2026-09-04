import { Fragment, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { brand } from "@/lib/brandColors";
import { inputStyle } from "@/lib/formStyles";
import { SiteSearchField } from "./SiteSearchField";
import { HazmatSearchField } from "./HazmatSearchField";
import { FederalWasteCodeField } from "./FederalWasteCodeField";
import { StateWasteCodeNote } from "@/components/StateWasteCodeNote";
import { SYSTEM_DEFAULT_EMERGENCY_PHONE } from "@/lib/constants";
import type { SiteSearchResultItem, FederalWasteCode } from "@/lib/rcrainfo/types";
import type { HazmatEntry } from "@/lib/hazmat/types";
import type { WasteProfile } from "@/services/wasteProfileRepository";

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

export interface HandlerFormState {
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

export const DEFAULT_SITE: HandlerFormState = {
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

/** All-blank handler, for contexts where prefilling fake test-site data
 * would be actively wrong (e.g. a delegate entering a real shipment's
 * details) rather than a preprod-testing convenience. */
export const BLANK_HANDLER: HandlerFormState = {
  epaSiteId: "",
  name: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  emergencyPhone: SYSTEM_DEFAULT_EMERGENCY_PHONE,
  address1: "",
  city: "",
  state: "",
  zip: "",
};

export interface TransporterFormState {
  id: number;
  epaSiteId: string;
  name: string;
}

export function emptyTransporter(id: number, prefill: boolean): TransporterFormState {
  return {
    id,
    epaSiteId: prefill ? "VATEST000001" : "",
    name: prefill ? "TEST TRANSPORTER 1 OF VA" : "",
  };
}

export interface WasteLineFormState {
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
  /** ManifestMate-only -- RCRAInfo's schema has no such field. Captured
   * here so an LDR notice filed later for this manifest (40 CFR 268.40)
   * doesn't have to guess. Only meaningful once a federal waste code is
   * entered, so the field is hidden until then. */
  wastewaterCategory: "wastewater" | "nonwastewater";
  /** ManifestMate-only, same reasoning as wastewaterCategory -- lets an
   * LDR notice filed later default straight to the lab pack certification
   * (40 CFR 268.42(c)) instead of the generic "requires treatment" default. */
  isLabPack: boolean;
  wasteDescription: string;
  quantity: string;
  unitCode: string;
  containerNumber: string;
  containerTypeCode: string;
  /** Prints into Box 14 (Special Handling Instructions), tagged by line number. */
  specialInstructions: string;
}

export function emptyWasteLine(id: number, prefill: boolean): WasteLineFormState {
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
    wastewaterCategory: "nonwastewater",
    isLabPack: false,
    wasteDescription: "",
    quantity: prefill ? "1" : "",
    unitCode: prefill ? "P" : "",
    containerNumber: prefill ? "1" : "",
    containerTypeCode: prefill ? "DM" : "",
    specialInstructions: "",
  };
}

/**
 * Generator and designated facility share the same form shape
 * (`HandlerFormState`) and the same fill logic — EPA's registered contact
 * (name/address/phone/email/emergency phone) overwrites whatever
 * placeholder was there before, since leaving it unfilled previously let
 * default test-site data silently end up on printed manifests. Exported
 * (not a component-internal closure) since the owner create page's CSV/
 * JSON import feature (ImportManifestData.tsx's handleImport) also needs
 * it directly, outside this component.
 */
export function fillHandlerFromSite(
  site: SiteSearchResultItem,
  current: HandlerFormState,
  defaultEmergencyPhone: string
): HandlerFormState {
  return {
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
  };
}

type FederalWasteCodesFn = () => Promise<
  { success: true; codes: FederalWasteCode[] } | { success: false; error: string }
>;

export interface ManifestFieldsFormProps {
  generator: HandlerFormState;
  setGenerator: Dispatch<SetStateAction<HandlerFormState>>;
  facility: HandlerFormState;
  setFacility: Dispatch<SetStateAction<HandlerFormState>>;
  transporters: TransporterFormState[];
  setTransporters: Dispatch<SetStateAction<TransporterFormState[]>>;
  wasteLines: WasteLineFormState[];
  setWasteLines: Dispatch<SetStateAction<WasteLineFormState[]>>;
  agencyAuthorityGranted: boolean;
  setAgencyAuthorityGranted: Dispatch<SetStateAction<boolean>>;
  handlingInstructions: string;
  setHandlingInstructions: Dispatch<SetStateAction<string>>;
  defaultEmergencyPhone: string;
  /** Federal-waste-code lookup override for a no-account context
   * (waste-line-edit delegate) — see FederalWasteCodeField's own prop
   * comment. Omit for the logged-in owner create form, which uses the
   * default logged-in action. */
  federalWasteCodesFn?: FederalWasteCodesFn;
  /** The current user's saved waste profiles, for the per-line "load from
   * profile" picker below. Omit (or pass an empty array) to hide that
   * picker entirely, e.g. in a context with no logged-in owner to fetch
   * profiles for. */
  wasteProfiles?: WasteProfile[];
  /**
   * `"edit"` (default): every fieldset is editable, the owner's
   * `/manifests/new` behavior, unchanged.
   * `"wasteLinesOnly"`: generator/transporter(s)/designated-facility
   * render as plain read-only text (from whatever values were passed in —
   * a live-fetched manifest, not client-editable) and the base
   * handling-instructions textarea is hidden entirely. Only the
   * waste-lines fieldset is editable. Used by the waste-line-edit
   * delegate flow (`/edit-waste-lines/[token]`) — this is a UI-clarity
   * measure only, not the real enforcement: the server-side action never
   * uses client-submitted header fields regardless of what this renders
   * (see submitWasteLineEditAction, which always live-refetches the
   * manifest for generator/transporter/facility).
   */
  mode?: "edit" | "wasteLinesOnly";
}

/** Read-only display for a locked-out section in `mode="wasteLinesOnly"` — see that prop's comment for why this is a UI-clarity measure, not the real enforcement. */
function ReadOnlyHandlerFieldset({ title, name, epaSiteId }: { title: string; name: string; epaSiteId: string }) {
  return (
    <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px", background: "#fafafa" }}>
      <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>{title}</legend>
      <p style={{ fontSize: "14px", color: "#333", margin: 0 }}>
        {name || "—"} ({epaSiteId || "—"})
      </p>
      <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0" }}>Set by whoever created this manifest — not editable here.</p>
    </fieldset>
  );
}

/**
 * The generator/transporter(s)/designated-facility/waste-line fieldsets
 * shared between the owner's `/manifests/new` create form (`mode="edit"`,
 * default) and the waste-line-edit delegate's `/edit-waste-lines/[token]`
 * form (`mode="wasteLinesOnly"`) — same field name conventions throughout,
 * so buildNewManifestInputFromFormData/buildWasteLinesFromFormData parse
 * either mode's FormData identically. Does NOT render the submit
 * button(s) or the hidden hint text around them — those differ per
 * context and stay in each page.
 */
export function ManifestFieldsForm({
  generator,
  setGenerator,
  facility,
  setFacility,
  transporters,
  setTransporters,
  wasteLines,
  setWasteLines,
  agencyAuthorityGranted,
  setAgencyAuthorityGranted,
  handlingInstructions,
  setHandlingInstructions,
  defaultEmergencyPhone,
  federalWasteCodesFn,
  wasteProfiles = [],
  mode = "edit",
}: ManifestFieldsFormProps) {
  const wasteLinesOnly = mode === "wasteLinesOnly";
  // Keyed by line id -- set when a profile's disposal facility EPA ID
  // doesn't match the manifest's current designated facility, cleared on a
  // successful load. Deliberately blocks applying the profile's fields
  // rather than just warning, per the "no chance of using the wrong
  // facility's profile" requirement.
  const [profileMismatchError, setProfileMismatchError] = useState<Record<number, string | null>>({});
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

  const fillGeneratorFromSite = (site: SiteSearchResultItem) =>
    setGenerator((g) => fillHandlerFromSite(site, g, defaultEmergencyPhone));

  const fillFacilityFromSite = (site: SiteSearchResultItem) =>
    setFacility((f) => fillHandlerFromSite(site, f, defaultEmergencyPhone));

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

  /** Applies a saved waste profile to one waste line -- refuses to apply
   * anything if the profile's disposal facility EPA ID doesn't exactly
   * match the manifest's current designated facility, so a profile
   * approved for one TSDF can never end up on a shipment to another. */
  const applyWasteProfile = (lineId: number, profile: WasteProfile) => {
    const facilityEpaId = facility.epaSiteId.trim().toUpperCase();
    const profileEpaId = profile.disposalFacilityEpaId.trim().toUpperCase();

    if (!facilityEpaId || facilityEpaId !== profileEpaId) {
      setProfileMismatchError((m) => ({
        ...m,
        [lineId]: `This profile is approved for ${profile.disposalFacilityName || "an unnamed facility"} (${profile.disposalFacilityEpaId}), not the designated facility on this manifest${facility.epaSiteId ? ` (${facility.epaSiteId})` : ""}. Set the matching designated facility first, or choose a different profile.`,
      }));
      return;
    }
    setProfileMismatchError((m) => ({ ...m, [lineId]: null }));

    const line = wasteLines.find((l) => l.id === lineId);
    const approvalNote = profile.disposalFacilityProfileNumber
      ? `TSDF Approval #: ${profile.disposalFacilityProfileNumber}`
      : "";
    const existingNote = line?.specialInstructions.trim() ?? "";
    const specialInstructions = approvalNote
      ? existingNote
        ? `${existingNote}; ${approvalNote}`
        : approvalNote
      : existingNote;

    updateWasteLine(lineId, {
      dotHazardous: profile.dotHazardous,
      isRcraWaste: profile.isRcraWaste,
      properShippingName: profile.properShippingName,
      rqIndicator: profile.rqIndicator,
      hazardClass: profile.hazardClass,
      packingGroup: profile.packingGroup,
      idNumberCode: profile.idNumberCode,
      federalWasteCode: profile.federalWasteCode,
      wastewaterCategory: profile.wastewaterCategory,
      isLabPack: profile.isLabPack,
      wasteDescription: profile.wasteDescription,
      ...(profile.defaultUnitCode ? { unitCode: profile.defaultUnitCode } : {}),
      ...(profile.defaultContainerTypeCode ? { containerTypeCode: profile.defaultContainerTypeCode } : {}),
      specialInstructions,
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
    <>
      <input type="hidden" name="wasteLineIds" value={wasteLines.map((l) => l.id).join(",")} />
      {!wasteLinesOnly && (
        <input type="hidden" name="transporterIds" value={transporters.map((t) => t.id).join(",")} />
      )}

      {wasteLinesOnly ? (
        <ReadOnlyHandlerFieldset title="Generator" name={generator.name} epaSiteId={generator.epaSiteId} />
      ) : (
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
        <StateWasteCodeNote state={generator.state} />
      </fieldset>
      )}

      {wasteLinesOnly
        ? transporters.map((t, index) => (
            <ReadOnlyHandlerFieldset key={t.id} title={`Transporter ${index + 1}`} name={t.name} epaSiteId={t.epaSiteId} />
          ))
        : transporters.map((t, index) => (
        <fieldset key={t.id} style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
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
          {index === 0 && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "13px",
                color: "#444",
                background: "#f7f7f7",
                padding: "8px 12px",
                borderRadius: "6px",
                marginBottom: "12px",
                cursor: "pointer",
              }}
            >
              <input
                name="agencyAuthorityGranted"
                type="checkbox"
                checked={agencyAuthorityGranted}
                onChange={(e) => setAgencyAuthorityGranted(e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <span>
                The generator&apos;s contract with this transporter confers agency authority to add
                or substitute additional transporters on the generator&apos;s behalf (40 CFR
                263.21(b)(3)). Checking this writes that certification into Item 14.{" "}
                <Link href="/university/transporter-agency-authority" target="_blank" style={{ color: brand.blue }}>
                  For more info…
                </Link>
              </span>
            </label>
          )}
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

      {!wasteLinesOnly && (
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
      )}

      {wasteLinesOnly ? (
        <ReadOnlyHandlerFieldset title="Designated facility" name={facility.name} epaSiteId={facility.epaSiteId} />
      ) : (
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
        <StateWasteCodeNote state={facility.state} />
      </fieldset>
      )}

      {wasteLines.map((line, index) => (
        <Fragment key={line.id}>
        {index > 0 && <hr style={{ border: "none", borderTop: "4px solid #000", margin: "0 0 20px" }} />}
        <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px" }}>
          <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>
            Waste line {index + 1} ({continuationLabel(index)})
          </legend>

          {wasteProfiles.length > 0 && (
            <div style={field}>
              <label style={label}>
                Load from saved waste profile (optional) —{" "}
                <Link href="/profiles" target="_blank" style={{ color: brand.blue, fontWeight: 400 }}>
                  manage profiles
                </Link>
              </label>
              <select
                value=""
                onChange={(e) => {
                  const profile = wasteProfiles.find((p) => p.id === e.target.value);
                  if (profile) applyWasteProfile(line.id, profile);
                }}
                style={inputStyle}
              >
                <option value="">— Select a profile —</option>
                {wasteProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.profileName} ({p.mmProfileNumber})
                  </option>
                ))}
              </select>
              {profileMismatchError[line.id] && (
                <p style={{ color: "#c00", fontSize: "13px", margin: "4px 0 0" }}>
                  {profileMismatchError[line.id]}
                </p>
              )}
            </div>
          )}

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
              <label style={label}>Special instructions for this line (optional — prints into Box 14)</label>
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
                    DOT ID number code (from search above — search by ID number too, e.g. &quot;UN1993&quot;)
                  </label>
                  <input
                    name={`idNumberCode_${line.id}`}
                    value={line.idNumberCode}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                  />
                </div>
                <div style={field}>
                  <label style={label}>
                    Federal waste codes (optional) —{" "}
                    <Link href="/university/waste-determination" style={{ color: brand.blue, fontWeight: 400 }}>
                      which apply?
                    </Link>
                  </label>
                  <FederalWasteCodeField
                    name={`federalWasteCode_${line.id}`}
                    value={line.federalWasteCode}
                    onChange={(v) => updateWasteLine(line.id, { federalWasteCode: v })}
                    fetchFn={federalWasteCodesFn}
                  />
                  {line.federalWasteCode.trim().length > 0 && (
                    <div style={{ marginTop: "6px" }}>
                      <label style={{ ...label, marginBottom: "2px" }}>
                        Wastewater or nonwastewater? (for a future{" "}
                        <Link href="/university/land-disposal-restrictions" style={{ color: brand.blue, fontWeight: 400 }}>
                          LDR notice
                        </Link>
                        )
                      </label>
                      <div style={{ display: "flex", gap: "14px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                          <input
                            type="radio"
                            name={`wastewaterCategory_${line.id}`}
                            value="nonwastewater"
                            checked={line.wastewaterCategory === "nonwastewater"}
                            onChange={() => updateWasteLine(line.id, { wastewaterCategory: "nonwastewater" })}
                          />
                          Nonwastewater
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                          <input
                            type="radio"
                            name={`wastewaterCategory_${line.id}`}
                            value="wastewater"
                            checked={line.wastewaterCategory === "wastewater"}
                            onChange={() => updateWasteLine(line.id, { wastewaterCategory: "wastewater" })}
                          />
                          Wastewater
                        </label>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", marginTop: "6px" }}>
                        <input
                          type="checkbox"
                          name={`labPack_${line.id}`}
                          checked={line.isLabPack}
                          onChange={(e) => updateWasteLine(line.id, { isLabPack: e.target.checked })}
                        />
                        This is a lab pack (40 CFR 268.42(c))
                      </label>
                    </div>
                  )}
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
            Quantity, unit, container count, and container type are all required once this line has
            a description.
          </p>
          <div style={row}>
            <div style={field}>
              <label style={label}>Quantity</label>
              <input
                name={`quantity_${line.id}`}
                type="number"
                step="any"
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
        </Fragment>
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

      {!wasteLinesOnly && (
      <div style={{ marginBottom: "20px" }}>
        <label style={label}>
          Special handling instructions (optional — Box 14. RCRAInfo prints this, plus any per-line
          notes, all on page 1 regardless of which page the line is on — there&apos;s no separate box
          per continuation sheet.)
        </label>
        <textarea
          name="handlingInstructions"
          rows={3}
          value={handlingInstructions}
          onChange={(e) => setHandlingInstructions(e.target.value)}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      )}
    </>
  );
}
