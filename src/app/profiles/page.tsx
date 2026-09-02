"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  createWasteProfileAction,
  updateWasteProfileAction,
  deleteWasteProfileAction,
  listWasteProfilesForUserAction,
  type WasteProfileActionState,
} from "@/app/actions/wasteProfileActions";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import { HazmatSearchField } from "@/app/manifests/new/HazmatSearchField";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import type { HazmatEntry } from "@/lib/hazmat/types";

const textareaStyle =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-vertical";

export default function WasteProfilesPage() {
  const [profiles, setProfiles] = useState<WasteProfile[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => {
    listWasteProfilesForUserAction().then(setProfiles);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this waste profile? This can't be undone.")) return;
    setDeletingId(id);
    await deleteWasteProfileAction(id);
    setDeletingId(null);
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Waste profiles</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Save a waste stream once, then load it onto a new manifest&apos;s waste line instead
            of retyping it. Each profile is tied to one disposal facility by EPA ID — loading a
            profile onto a manifest bound for a different facility is blocked automatically.
          </p>
        </div>
        <Link href="/manifests/new" className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline">
          ← Create a manifest
        </Link>
      </div>

      <Card className="p-6">
        {!showCreate ? (
          <Button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm">
            + Add waste profile
          </Button>
        ) : (
          <WasteProfileForm
            mode="create"
            onDone={() => {
              setShowCreate(false);
              refresh();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </Card>

      <div className="mt-6 flex flex-col gap-4">
        {profiles === null && <p className="text-sm text-gray-500">Loading…</p>}
        {profiles?.length === 0 && <p className="text-sm text-gray-500">No saved waste profiles yet.</p>}
        {profiles?.map((p) =>
          editingId === p.id ? (
            <Card key={p.id} className="p-6">
              <WasteProfileForm
                mode="edit"
                profile={p}
                onDone={() => {
                  setEditingId(null);
                  refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            </Card>
          ) : (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    {p.profileName} <span className="font-normal text-gray-400">— {p.mmProfileNumber}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {p.dotHazardous ? p.properShippingName : p.wasteDescription}
                    {p.hazardClass && ` · Class ${p.hazardClass}`}
                    {p.idNumberCode && ` · ${p.idNumberCode}`}
                    {p.federalWasteCode && ` · ${p.federalWasteCode}`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Disposal facility: {p.disposalFacilityName || "—"} ({p.disposalFacilityEpaId})
                    {p.disposalFacilityProfileNumber && ` · Facility profile # ${p.disposalFacilityProfileNumber}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button type="button" onClick={() => setEditingId(p.id)} className="font-medium text-brand-blue">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="font-medium text-red-600 disabled:opacity-50"
                  >
                    {deletingId === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function WasteProfileForm({
  mode,
  profile,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  profile?: WasteProfile;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === "create" ? createWasteProfileAction : updateWasteProfileAction;
  const [state, formAction, isPending] = useActionState<WasteProfileActionState, FormData>(action, null);

  const [dotHazardous, setDotHazardous] = useState(profile?.dotHazardous ?? true);
  const [isRcraWaste, setIsRcraWaste] = useState(profile?.isRcraWaste ?? true);
  const [federalWasteCode, setFederalWasteCode] = useState(profile?.federalWasteCode ?? "");

  // Controlled (rather than defaultValue) specifically so the RCRAInfo
  // facility search and the DOT hazmat table search below can populate
  // them programmatically -- every other field on this form stays
  // uncontrolled since nothing else needs to write into it from code.
  const [disposalFacilityName, setDisposalFacilityName] = useState(profile?.disposalFacilityName ?? "");
  const [disposalFacilityEpaId, setDisposalFacilityEpaId] = useState(profile?.disposalFacilityEpaId ?? "");
  const [properShippingName, setProperShippingName] = useState(profile?.properShippingName ?? "");
  const [hazardClass, setHazardClass] = useState(profile?.hazardClass ?? "");
  const [packingGroup, setPackingGroup] = useState(profile?.packingGroup ?? "");
  const [idNumberCode, setIdNumberCode] = useState(profile?.idNumberCode ?? "");

  const fillFacilityFromSite = (site: SiteSearchResultItem) => {
    setDisposalFacilityName(site.name);
    setDisposalFacilityEpaId(site.epaSiteId);
  };

  const fillWasteFromHazmat = (entry: HazmatEntry) => {
    // Same "waste" double-up guard as ManifestFieldsForm's
    // fillWasteLineFromHazmat -- a few §172.101 entries already have
    // "waste" baked into the shipping name.
    const nameAlreadyIncludesWaste = /\bwaste\b/i.test(entry.properShippingName);
    setProperShippingName(entry.properShippingName);
    setHazardClass(entry.hazardClass);
    setPackingGroup(entry.packingGroup);
    setIdNumberCode(entry.idNumbers);
    if (nameAlreadyIncludesWaste) setIsRcraWaste(false);
  };

  useEffect(() => {
    if (state?.success) onDone();
    // onDone is stable enough per-mount for this one-shot "close on success" effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {mode === "edit" && profile && <input type="hidden" name="id" value={profile.id} />}

      <Input
        id="profileName"
        name="profileName"
        label="Profile name"
        required
        defaultValue={profile?.profileName}
        placeholder="e.g. Used Oil — Building A"
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-navy">
          Search registered disposal facilities (RCRAInfo)
        </label>
        <SiteSearchField siteType="Tsdf" placeholder="Search by facility name…" onSelect={fillFacilityFromSite} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="disposalFacilityName"
          name="disposalFacilityName"
          label="Disposal facility name"
          value={disposalFacilityName}
          onChange={(e) => setDisposalFacilityName(e.target.value)}
        />
        <Input
          id="disposalFacilityEpaId"
          name="disposalFacilityEpaId"
          label="Disposal facility EPA ID"
          required
          value={disposalFacilityEpaId}
          onChange={(e) => setDisposalFacilityEpaId(e.target.value)}
          hint="Must match the manifest's designated facility exactly, or the profile can't be loaded."
        />
      </div>
      <Input
        id="disposalFacilityProfileNumber"
        name="disposalFacilityProfileNumber"
        label="Disposal facility's own profile / approval number (optional)"
        defaultValue={profile?.disposalFacilityProfileNumber}
        hint="Printed into the waste line's notes (Box 14) when this profile is loaded."
      />

      <label className="flex items-center gap-2 text-sm text-brand-navy">
        <input
          type="checkbox"
          name="dotHazardous"
          defaultChecked={profile?.dotHazardous ?? true}
          onChange={(e) => setDotHazardous(e.target.checked)}
        />
        DOT hazardous material
      </label>

      {dotHazardous ? (
        <>
          <label className="flex items-center gap-2 text-sm text-brand-navy">
            <input
              type="checkbox"
              name="isRcraWaste"
              checked={isRcraWaste}
              onChange={(e) => setIsRcraWaste(e.target.checked)}
            />
            RCRA waste (prints &quot;Waste&quot;)
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-navy">
              Search DOT hazardous materials table (49 CFR §172.101)
            </label>
            <HazmatSearchField placeholder="Search by shipping name or ID number…" onSelect={fillWasteFromHazmat} />
          </div>
          <div>
            <label htmlFor="properShippingName" className="mb-1 block text-sm font-medium text-brand-navy">
              Proper shipping name
            </label>
            <textarea
              id="properShippingName"
              name="properShippingName"
              rows={2}
              value={properShippingName}
              onChange={(e) => setProperShippingName(e.target.value)}
              className={textareaStyle}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-navy">
              <input type="checkbox" name="rqIndicator" defaultChecked={profile?.rqIndicator} />
              RQ (reportable quantity)
            </label>
            <Input
              id="hazardClass"
              name="hazardClass"
              label="Hazard class"
              value={hazardClass}
              onChange={(e) => setHazardClass(e.target.value)}
            />
            <Input
              id="packingGroup"
              name="packingGroup"
              label="Packing group"
              value={packingGroup}
              onChange={(e) => setPackingGroup(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="idNumberCode"
              name="idNumberCode"
              label="DOT ID number (e.g. UN1993)"
              value={idNumberCode}
              onChange={(e) => setIdNumberCode(e.target.value)}
            />
            <Input
              id="federalWasteCode"
              name="federalWasteCode"
              label="Federal waste codes"
              defaultValue={profile?.federalWasteCode}
              onChange={(e) => setFederalWasteCode(e.target.value)}
            />
          </div>
          {federalWasteCode.trim().length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium text-brand-navy">Wastewater or nonwastewater?</p>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="wastewaterCategory"
                      value="nonwastewater"
                      defaultChecked={(profile?.wastewaterCategory ?? "nonwastewater") === "nonwastewater"}
                    />
                    Nonwastewater
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="wastewaterCategory"
                      value="wastewater"
                      defaultChecked={profile?.wastewaterCategory === "wastewater"}
                    />
                    Wastewater
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-navy">
                <input type="checkbox" name="isLabPack" defaultChecked={profile?.isLabPack} />
                Lab pack (40 CFR 268.42(c))
              </label>
            </div>
          )}
        </>
      ) : (
        <Input
          id="wasteDescription"
          name="wasteDescription"
          label="Waste description"
          defaultValue={profile?.wasteDescription}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="defaultUnitCode"
          name="defaultUnitCode"
          label="Default unit code (optional)"
          defaultValue={profile?.defaultUnitCode}
        />
        <Input
          id="defaultContainerTypeCode"
          name="defaultContainerTypeCode"
          label="Default container type code (optional)"
          defaultValue={profile?.defaultContainerTypeCode}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending} className="px-4 py-2 text-sm">
          {isPending ? "Saving…" : mode === "create" ? "Save profile" : "Save changes"}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
      {state?.success === false && <p className="text-sm text-red-600">❌ {state.error}</p>}
    </form>
  );
}
