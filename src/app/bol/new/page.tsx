"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBillOfLadingAction } from "@/app/actions/billOfLadingActions";
import { listWasteProfilesForUserAction } from "@/app/actions/wasteProfileActions";
import { UNIT_CODES, CONTAINER_TYPE_CODES } from "@/lib/rcrainfo/manifestCodes";
import { brand } from "@/lib/brandColors";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import type { BillOfLading } from "@/services/billOfLadingRepository";
import { BolPrintLabelsPanel } from "../BolPrintLabelsPanel";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";

const row = { display: "flex", gap: "10px" };
const field = { flex: 1, marginBottom: "12px" };
const label = { display: "block", marginBottom: "5px", fontSize: "14px" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PartyState {
  epaSiteId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  contactPhone: string;
}

const BLANK_PARTY: PartyState = {
  epaSiteId: "",
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  contactName: "",
  contactPhone: "",
};

/** Fills a party's fields from a live EPA site-search result -- same
 * fill-from-search convention as the real manifest form's
 * fillHandlerFromSite, adapted to this simpler shape (no separate
 * first/last name or email, since a bill of lading only needs one
 * contact name/phone). Falls back to "" (not the previous value) when
 * EPA's record is missing a field, same reasoning as the manifest
 * version -- an empty field is an honest "needs manual entry" signal. */
function fillPartyFromSite(site: SiteSearchResultItem, current: PartyState): PartyState {
  return {
    ...current,
    epaSiteId: site.epaSiteId,
    name: site.name,
    address: site.siteAddress?.address1 ?? "",
    city: site.siteAddress?.city ?? "",
    state: site.siteAddress?.state?.code ?? "",
    zip: site.siteAddress?.zip ?? "",
    contactName: [site.contact?.firstName, site.contact?.lastName].filter(Boolean).join(" "),
    contactPhone: site.contact?.phoneNumber?.number ?? "",
  };
}

interface LineState {
  id: number;
  wasteProfileId: string | null;
  description: string;
  quantity: string;
  unitCode: string;
  containerNumber: string;
  containerTypeCode: string;
  specialInstructions: string;
}

function emptyLine(id: number): LineState {
  return { id, wasteProfileId: null, description: "", quantity: "", unitCode: "", containerNumber: "", containerTypeCode: "", specialInstructions: "" };
}

function PartyFieldset({
  title,
  siteType,
  party,
  setParty,
}: {
  title: string;
  siteType: "Generator" | "Transporter" | "Tsdf" | "Broker";
  party: PartyState;
  setParty: (p: PartyState) => void;
}) {
  const set = (patch: Partial<PartyState>) => setParty({ ...party, ...patch });
  return (
    <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px", padding: "12px" }}>
      <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>{title}</legend>
      <SiteSearchField
        siteType={siteType}
        placeholder={`Search registered ${title.toLowerCase()} sites by name…`}
        onSelect={(site) => setParty(fillPartyFromSite(site, party))}
      />
      <div style={row}>
        <div style={field}>
          <label style={label}>Company name</label>
          <input style={inputStyle} value={party.name} onChange={(e) => set({ name: e.target.value })} required />
        </div>
        <div style={field}>
          <label style={label}>EPA Site ID (optional)</label>
          <input style={inputStyle} value={party.epaSiteId} onChange={(e) => set({ epaSiteId: e.target.value })} />
        </div>
        <div style={field}>
          <label style={label}>Contact name</label>
          <input style={inputStyle} value={party.contactName} onChange={(e) => set({ contactName: e.target.value })} />
        </div>
        <div style={field}>
          <label style={label}>Contact phone</label>
          <input style={inputStyle} value={party.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
        </div>
      </div>
      <div style={row}>
        <div style={{ ...field, flex: 2 }}>
          <label style={label}>Address</label>
          <input style={inputStyle} value={party.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
        <div style={field}>
          <label style={label}>City</label>
          <input style={inputStyle} value={party.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div style={{ ...field, flex: 0.5 }}>
          <label style={label}>State</label>
          <input style={inputStyle} value={party.state} onChange={(e) => set({ state: e.target.value })} maxLength={2} />
        </div>
        <div style={{ ...field, flex: 0.7 }}>
          <label style={label}>Zip</label>
          <input style={inputStyle} value={party.zip} onChange={(e) => set({ zip: e.target.value })} />
        </div>
      </div>
    </fieldset>
  );
}

export default function NewBillOfLadingPage() {
  const [shipper, setShipper] = useState<PartyState>(BLANK_PARTY);
  const [consignee, setConsignee] = useState<PartyState>(BLANK_PARTY);
  const [carrierEpaId, setCarrierEpaId] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [carrierContactName, setCarrierContactName] = useState("");
  const [carrierContactPhone, setCarrierContactPhone] = useState("");
  const [shipDate, setShipDate] = useState(todayIso());
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine(0)]);
  const [wasteProfiles, setWasteProfiles] = useState<WasteProfile[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<BillOfLading | null>(null);

  useEffect(() => {
    listWasteProfilesForUserAction().then(setWasteProfiles);
  }, []);

  // Only non-RCRA-waste profiles apply here -- an actual RCRA hazardous
  // waste stream belongs on a real e-Manifest, not a bill of lading.
  const nonRcraProfiles = wasteProfiles.filter((p) => !p.isRcraWaste);

  const updateLine = (id: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () => setLines((ls) => [...ls, emptyLine(ls.length ? Math.max(...ls.map((l) => l.id)) + 1 : 0)]);
  const removeLine = (id: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

  const applyProfile = (id: number, profileId: string) => {
    if (!profileId) {
      updateLine(id, { wasteProfileId: null });
      return;
    }
    const profile = nonRcraProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    updateLine(id, {
      wasteProfileId: profile.id,
      description: (profile.dotHazardous ? profile.properShippingName : profile.wasteDescription) || profile.profileName,
      unitCode: profile.defaultUnitCode || "",
      containerTypeCode: profile.defaultContainerTypeCode || "",
    });
  };

  const handleSubmit = async () => {
    setIsPending(true);
    setError(null);
    const result = await createBillOfLadingAction({
      shipDate,
      shipperName: shipper.name,
      shipperEpaId: shipper.epaSiteId,
      shipperAddress: shipper.address,
      shipperCity: shipper.city,
      shipperState: shipper.state,
      shipperZip: shipper.zip,
      shipperContactName: shipper.contactName,
      shipperContactPhone: shipper.contactPhone,
      consigneeName: consignee.name,
      consigneeEpaId: consignee.epaSiteId,
      consigneeAddress: consignee.address,
      consigneeCity: consignee.city,
      consigneeState: consignee.state,
      consigneeZip: consignee.zip,
      consigneeContactName: consignee.contactName,
      consigneeContactPhone: consignee.contactPhone,
      carrierName,
      carrierEpaId,
      carrierContactName,
      carrierContactPhone,
      specialInstructions,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          wasteProfileId: l.wasteProfileId,
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitCode: l.unitCode,
          containerNumber: Number(l.containerNumber) || 0,
          containerTypeCode: l.containerTypeCode,
          specialInstructions: l.specialInstructions,
        })),
    });
    setIsPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(result.billOfLading);
  };

  if (saved) {
    return (
      <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
        <p>
          <Link href="/bol" style={{ color: brand.blue }}>← Bill of Lading</Link>
        </p>
        <div style={{ border: "1px solid #cde9cd", borderRadius: "6px", padding: "12px", marginBottom: "10px" }}>
          <p style={{ color: "green", margin: 0 }}>
            ✅ Saved as <strong>{saved.bolNumber}</strong> —{" "}
            <Link href={`/bol/${saved.id}/print`} style={{ color: brand.blue }} target="_blank">
              print this bill of lading
            </Link>
          </p>
          <BolPrintLabelsPanel billOfLading={saved} />
        </div>
        <button
          type="button"
          onClick={() => {
            setSaved(null);
            setShipper(BLANK_PARTY);
            setConsignee(BLANK_PARTY);
            setCarrierEpaId("");
            setCarrierName("");
            setCarrierContactName("");
            setCarrierContactPhone("");
            setSpecialInstructions("");
            setLines([emptyLine(0)]);
          }}
          style={primaryButtonStyle(false)}
        >
          + Create another
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", fontFamily: "sans-serif" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <Link href="/bol" style={{ color: brand.blue }}>← Bill of Lading</Link>
      </p>
      <h1 style={{ color: brand.navy }}>Create a bill of lading</h1>
      <p style={{ color: "#666" }}>
        For non-hazardous waste shipments only -- this never goes to EPA and isn&apos;t a regulated
        manifest. Only waste profiles <em>not</em> marked as RCRA waste show up in the line-item picker
        below.
      </p>

      <PartyFieldset title="Shipper" siteType="Generator" party={shipper} setParty={setShipper} />
      <PartyFieldset title="Consignee" siteType="Tsdf" party={consignee} setParty={setConsignee} />

      <fieldset style={{ marginBottom: "20px", border: "1px solid #ddd", borderRadius: "6px", padding: "12px" }}>
        <legend style={{ padding: "0 8px", color: brand.navy, fontWeight: 600 }}>Carrier</legend>
        <SiteSearchField
          siteType="Transporter"
          placeholder="Search registered transporter sites by name…"
          onSelect={(site) => {
            setCarrierEpaId(site.epaSiteId);
            setCarrierName(site.name);
            setCarrierContactName([site.contact?.firstName, site.contact?.lastName].filter(Boolean).join(" "));
            setCarrierContactPhone(site.contact?.phoneNumber?.number ?? "");
          }}
        />
        <div style={row}>
          <div style={field}>
            <label style={label}>Carrier / trucking company</label>
            <input style={inputStyle} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          </div>
          <div style={field}>
            <label style={label}>EPA Site ID (optional)</label>
            <input style={inputStyle} value={carrierEpaId} onChange={(e) => setCarrierEpaId(e.target.value)} />
          </div>
          <div style={field}>
            <label style={label}>Driver / contact name</label>
            <input style={inputStyle} value={carrierContactName} onChange={(e) => setCarrierContactName(e.target.value)} />
          </div>
          <div style={field}>
            <label style={label}>Contact phone</label>
            <input style={inputStyle} value={carrierContactPhone} onChange={(e) => setCarrierContactPhone(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div style={{ marginBottom: "20px" }}>
        <label style={label}>Ship date</label>
        <input type="date" style={{ ...inputStyle, maxWidth: "200px" }} value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
      </div>

      <h2 style={{ color: brand.navy, fontSize: "18px" }}>Line items</h2>
      {lines.map((line) => (
        <fieldset key={line.id} style={{ marginBottom: "14px", border: "1px solid #ddd", borderRadius: "6px", padding: "12px" }}>
          {nonRcraProfiles.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <label style={label}>Load from saved waste profile (optional)</label>
              <select
                style={inputStyle}
                value={line.wasteProfileId ?? ""}
                onChange={(e) => applyProfile(line.id, e.target.value)}
              >
                <option value="">— Select a profile —</option>
                {nonRcraProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.profileName} ({p.mmProfileNumber})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={field}>
            <label style={label}>Description</label>
            <input
              style={inputStyle}
              value={line.description}
              onChange={(e) => updateLine(line.id, { description: e.target.value, wasteProfileId: null })}
            />
          </div>
          <div style={row}>
            <div style={field}>
              <label style={label}>Quantity</label>
              <input
                type="number"
                style={inputStyle}
                value={line.quantity}
                onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>Unit</label>
              <select style={inputStyle} value={line.unitCode} onChange={(e) => updateLine(line.id, { unitCode: e.target.value })}>
                <option value="">—</option>
                {UNIT_CODES.map((u) => (
                  <option key={u.code} value={u.code}>{u.label}</option>
                ))}
              </select>
            </div>
            <div style={field}>
              <label style={label}>Container count</label>
              <input
                type="number"
                style={inputStyle}
                value={line.containerNumber}
                onChange={(e) => updateLine(line.id, { containerNumber: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>Container type</label>
              <select
                style={inputStyle}
                value={line.containerTypeCode}
                onChange={(e) => updateLine(line.id, { containerTypeCode: e.target.value })}
              >
                <option value="">—</option>
                {CONTAINER_TYPE_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={field}>
            <label style={label}>Special instructions for this line (optional)</label>
            <input
              style={inputStyle}
              value={line.specialInstructions}
              onChange={(e) => updateLine(line.id, { specialInstructions: e.target.value })}
            />
          </div>
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => removeLine(line.id)}
              style={{ background: "none", border: "none", color: "red", cursor: "pointer", padding: 0, fontSize: "13px" }}
            >
              Remove this line
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        onClick={addLine}
        style={{ background: "none", border: `1px solid ${brand.blue}`, color: brand.blue, borderRadius: "4px", padding: "6px 12px", cursor: "pointer", marginBottom: "20px" }}
      >
        + Add another line
      </button>

      <div style={{ marginBottom: "20px" }}>
        <label style={label}>Special handling instructions (optional)</label>
        <textarea
          style={{ ...inputStyle, minHeight: "60px" }}
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
        />
      </div>

      {error && <p style={{ color: "red" }}>❌ {error}</p>}

      <button type="button" onClick={handleSubmit} disabled={isPending} style={primaryButtonStyle(isPending)}>
        {isPending ? "Saving…" : "Save bill of lading"}
      </button>
    </div>
  );
}
