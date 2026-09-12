"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createWasteProfileAction,
  updateWasteProfileAction,
  type WasteProfileActionState,
} from "@/app/actions/wasteProfileActions";
import type { WasteProfile, WasteProfileInput, ShipmentFrequency, WasteCategory } from "@/services/wasteProfileRepository";
import { WASTE_CATEGORY_OPTIONS, WASTE_CATEGORY_BORDER } from "@/app/profiles/wasteCategoryOptions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SiteSearchField } from "@/app/manifests/new/SiteSearchField";
import { HazmatSearchField } from "@/app/manifests/new/HazmatSearchField";
import { UNIT_CODES, CONTAINER_TYPE_CODES } from "@/lib/rcrainfo/manifestCodes";
import { LockedGeneratorSelect } from "@/components/LockedGeneratorSelect";
import { getMyAccountTypeAction } from "@/app/actions/accountActions";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";
import type { HazmatEntry } from "@/lib/hazmat/types";

const textareaStyle =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue resize-vertical";
const selectStyle =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue bg-white";

const FREQUENCY_OPTIONS: { value: ShipmentFrequency; label: string }[] = [
  { value: "one_time", label: "One time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Biannual" },
  { value: "annual", label: "Annual" },
  { value: "other", label: "Other" },
];

// A no-op action to satisfy useActionState's signature in wizard mode --
// wizard mode never actually submits via the <form action> mechanism (see
// handleWizardSubmit below), so this is never called, just a stable
// reference of the right shape.
async function noopWizardAction(): Promise<WasteProfileActionState> {
  return null;
}

export type WizardConfidence = "confident" | "inferred";

/** ✓ Wizard / ⚑ Check this badge, shown only for fields the extraction
 * pipeline actually reported a confidence for -- badging every field would
 * bury the two that actually need attention (see the Wizard mockup's own
 * design note). */
function FieldFlag({ field, flags }: { field: keyof WasteProfileInput; flags?: Partial<Record<keyof WasteProfileInput, WizardConfidence>> }) {
  const confidence = flags?.[field];
  if (!confidence) return null;
  return confidence === "confident" ? (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
      ✓ Wizard
    </span>
  ) : (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
      ⚑ Check this
    </span>
  );
}

export function WasteProfileFormFields({
  mode,
  profile,
  initialValues,
  fixedGenerator,
  wizardFlags,
  queuePosition,
  sourceDocumentName,
  fileToAttach,
  onWizardSubmit,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit" | "wizard";
  profile?: WasteProfile;
  /** Wizard mode only: pre-fill from an extracted draft instead of an existing profile. */
  initialValues?: Partial<WasteProfileInput>;
  /** Wizard mode only: the generator is already fixed for the whole upload batch (picked once
   * in the Wizard's upload step), so the per-profile picker never shows. */
  fixedGenerator?: { epaId: string; name: string; address: string };
  wizardFlags?: Partial<Record<keyof WasteProfileInput, WizardConfidence>>;
  queuePosition?: { current: number; total: number };
  sourceDocumentName?: string;
  /** Wizard mode only: the original uploaded PDF, re-attached to the FormData on save. */
  fileToAttach?: File | null;
  /** Wizard mode only: replaces the create/update Server Action entirely. */
  onWizardSubmit?: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = mode === "create" ? createWasteProfileAction : mode === "edit" ? updateWasteProfileAction : noopWizardAction;
  const [state, formAction, isPending] = useActionState<WasteProfileActionState, FormData>(action, null);
  const [wizardPending, setWizardPending] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Reused throughout for pre-fill: an existing profile (edit mode) or an
  // extracted draft (wizard mode) -- WasteProfile is a structural superset
  // of WasteProfileInput, so this assignment is type-safe as-is.
  const defaults: Partial<WasteProfileInput> = profile ?? initialValues ?? {};

  const [dotHazardous, setDotHazardous] = useState(defaults.dotHazardous ?? true);
  const [isRcraWaste, setIsRcraWaste] = useState(defaults.isRcraWaste ?? true);
  const [federalWasteCode, setFederalWasteCode] = useState(defaults.federalWasteCode ?? "");

  const [wasteCategory, setWasteCategory] = useState<WasteCategory>(defaults.wasteCategory ?? "hazardous");
  const handleCategoryChange = (next: WasteCategory) => {
    setWasteCategory(next);
    setDotHazardous(next === "hazardous");
    setIsRcraWaste(next === "hazardous");
  };

  const [disposalFacilityName, setDisposalFacilityName] = useState(defaults.disposalFacilityName ?? "");
  const [disposalFacilityEpaId, setDisposalFacilityEpaId] = useState(defaults.disposalFacilityEpaId ?? "");
  const [generatorEpaId, setGeneratorEpaId] = useState(fixedGenerator?.epaId ?? defaults.generatorEpaId ?? "");
  const [generatorName, setGeneratorName] = useState(fixedGenerator?.name ?? defaults.generatorName ?? "");
  const [generatorAddress, setGeneratorAddress] = useState(fixedGenerator?.address ?? defaults.generatorAddress ?? "");
  const [accountType, setAccountType] = useState<string | null>(null);
  useEffect(() => {
    getMyAccountTypeAction().then(setAccountType);
  }, []);

  const fillGeneratorFromSite = (site: SiteSearchResultItem) => {
    const addr = site.siteAddress;
    setGeneratorEpaId(site.epaSiteId);
    setGeneratorName(site.name);
    setGeneratorAddress([addr?.address1, addr?.city, addr?.state?.code, addr?.zip].filter(Boolean).join(", "));
  };
  const [properShippingName, setProperShippingName] = useState(defaults.properShippingName ?? "");
  const [hazardClass, setHazardClass] = useState(defaults.hazardClass ?? "");
  const [packingGroup, setPackingGroup] = useState(defaults.packingGroup ?? "");
  const [idNumberCode, setIdNumberCode] = useState(defaults.idNumberCode ?? "");

  const [shipmentFrequency, setShipmentFrequency] = useState<ShipmentFrequency | "">(
    defaults.shipmentFrequency ?? ""
  );

  const fillFacilityFromSite = (site: SiteSearchResultItem) => {
    setDisposalFacilityName(site.name);
    setDisposalFacilityEpaId(site.epaSiteId);
  };

  const fillWasteFromHazmat = (entry: HazmatEntry) => {
    const nameAlreadyIncludesWaste = /\bwaste\b/i.test(entry.properShippingName);
    setProperShippingName(entry.properShippingName);
    setHazardClass(entry.hazardClass);
    setPackingGroup(entry.packingGroup);
    setIdNumberCode(entry.idNumbers);
    if (nameAlreadyIncludesWaste) setIsRcraWaste(false);
  };

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleWizardSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!onWizardSubmit) return;
    setWizardPending(true);
    setWizardError(null);
    const formData = new FormData(e.currentTarget);
    if (fileToAttach) formData.set("file", fileToAttach);
    const result = await onWizardSubmit(formData);
    setWizardPending(false);
    if (!result.success) {
      setWizardError(result.error ?? "Save failed.");
      return;
    }
    onDone();
  };

  const isWizard = mode === "wizard";
  const pending = isWizard ? wizardPending : isPending;

  return (
    <form
      action={isWizard ? undefined : formAction}
      onSubmit={isWizard ? handleWizardSubmit : undefined}
      className="flex flex-col gap-3"
    >
      {mode === "edit" && profile && <input type="hidden" name="id" value={profile.id} />}

      {isWizard && queuePosition && (
        <div className="inline-flex w-fit items-center rounded-full bg-brand-blue/10 px-2.5 py-1 text-xs font-bold text-brand-blue">
          Profile {queuePosition.current} of {queuePosition.total}
        </div>
      )}
      {isWizard && sourceDocumentName && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-600">
          📎 Source document: <span className="font-semibold">{sourceDocumentName}</span> — stays attached to
          this profile, viewable later from its own page
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy">
          Waste category <FieldFlag field="wasteCategory" flags={wizardFlags} />
        </p>
        <input type="hidden" name="wasteCategory" value={wasteCategory} />
        <div className="grid gap-2 sm:grid-cols-3">
          {WASTE_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleCategoryChange(opt.value)}
              className={`rounded-md p-2 text-left ${
                wasteCategory === opt.value
                  ? `${WASTE_CATEGORY_BORDER[opt.value]} bg-brand-tint`
                  : "border-2 border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold text-brand-navy">{opt.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <Input
        id="profileName"
        name="profileName"
        label="Profile name"
        required
        defaultValue={profile?.profileName}
        placeholder="e.g. Used Oil — Building A"
        hint={isWizard ? "Not in this document — name this profile yourself" : undefined}
      />

      {!generatorEpaId && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-navy">Select a generator</label>
          <p className="mb-1 text-xs text-gray-500">
            Every waste profile is now tied to a generator — this profile, and any label printed
            from it, will always be for this site.
          </p>
          <LockedGeneratorSelect
            onSelect={fillGeneratorFromSite}
            source={accountType === "third_party" ? "customers" : "managed"}
          />
        </div>
      )}

      {generatorEpaId && (
        <>
          <input type="hidden" name="generatorEpaId" value={generatorEpaId} />
          <input type="hidden" name="generatorName" value={generatorName} />
          <input type="hidden" name="generatorAddress" value={generatorAddress} />
          <div className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand-navy">
            <span className="font-semibold">Generator:</span> {generatorName} ({generatorEpaId})
          </div>

      {!isWizard && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-navy">
            Search registered disposal facilities (RCRAInfo)
          </label>
          <SiteSearchField siteType="Tsdf" placeholder="Search by facility name…" onSelect={fillFacilityFromSite} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input
            id="disposalFacilityName"
            name="disposalFacilityName"
            label="Disposal facility name"
            value={disposalFacilityName}
            onChange={(e) => setDisposalFacilityName(e.target.value)}
          />
          <FieldFlag field="disposalFacilityName" flags={wizardFlags} />
        </div>
        <div>
          <Input
            id="disposalFacilityEpaId"
            name="disposalFacilityEpaId"
            label="Disposal facility EPA ID"
            required
            value={disposalFacilityEpaId}
            onChange={(e) => setDisposalFacilityEpaId(e.target.value)}
            hint="Must match the manifest's designated facility exactly, or the profile can't be loaded."
          />
          <FieldFlag field="disposalFacilityEpaId" flags={wizardFlags} />
        </div>
      </div>
      <div>
        <Input
          id="disposalFacilityProfileNumber"
          name="disposalFacilityProfileNumber"
          label="Disposal facility's own profile / approval number (optional)"
          defaultValue={defaults.disposalFacilityProfileNumber}
          hint="Printed into the waste line's notes (Box 14) when this profile is loaded."
        />
        <FieldFlag field="disposalFacilityProfileNumber" flags={wizardFlags} />
      </div>

      <label className="flex items-center gap-2 text-sm text-brand-navy">
        <input
          type="checkbox"
          name="dotHazardous"
          defaultChecked={defaults.dotHazardous ?? true}
          onChange={(e) => setDotHazardous(e.target.checked)}
        />
        DOT hazardous material
        <FieldFlag field="dotHazardous" flags={wizardFlags} />
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
            <FieldFlag field="isRcraWaste" flags={wizardFlags} />
          </label>
          {!isWizard && (
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-navy">
                Search DOT hazardous materials table (49 CFR §172.101)
              </label>
              <HazmatSearchField placeholder="Search by shipping name or ID number…" onSelect={fillWasteFromHazmat} />
            </div>
          )}
          <div>
            <label htmlFor="properShippingName" className="mb-1 block text-sm font-medium text-brand-navy">
              Proper shipping name <FieldFlag field="properShippingName" flags={wizardFlags} />
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
              <input type="checkbox" name="rqIndicator" defaultChecked={defaults.rqIndicator} />
              RQ (reportable quantity)
            </label>
            <div>
              <Input
                id="hazardClass"
                name="hazardClass"
                label="Hazard class"
                value={hazardClass}
                onChange={(e) => setHazardClass(e.target.value)}
              />
              <FieldFlag field="hazardClass" flags={wizardFlags} />
            </div>
            <div>
              <Input
                id="packingGroup"
                name="packingGroup"
                label="Packing group"
                value={packingGroup}
                onChange={(e) => setPackingGroup(e.target.value)}
              />
              <FieldFlag field="packingGroup" flags={wizardFlags} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Input
                id="idNumberCode"
                name="idNumberCode"
                label="DOT ID number (e.g. UN1993)"
                value={idNumberCode}
                onChange={(e) => setIdNumberCode(e.target.value)}
              />
              <FieldFlag field="idNumberCode" flags={wizardFlags} />
            </div>
            <div>
              <Input
                id="federalWasteCode"
                name="federalWasteCode"
                label="Federal waste codes"
                defaultValue={defaults.federalWasteCode}
                onChange={(e) => setFederalWasteCode(e.target.value)}
              />
              <FieldFlag field="federalWasteCode" flags={wizardFlags} />
            </div>
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
                      defaultChecked={(defaults.wastewaterCategory ?? "nonwastewater") === "nonwastewater"}
                    />
                    Nonwastewater
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="wastewaterCategory"
                      value="wastewater"
                      defaultChecked={defaults.wastewaterCategory === "wastewater"}
                    />
                    Wastewater
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-navy">
                <input type="checkbox" name="isLabPack" defaultChecked={defaults.isLabPack} />
                Lab pack (40 CFR 268.42(c))
              </label>
            </div>
          )}
        </>
      ) : (
        <div>
          <Input
            id="wasteDescription"
            name="wasteDescription"
            label="Waste description"
            defaultValue={defaults.wasteDescription}
          />
          <FieldFlag field="wasteDescription" flags={wizardFlags} />
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="mb-1 text-sm font-semibold text-brand-navy">
          Waste characterization <span className="font-normal text-gray-400">(optional — printed on a container label)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-brand-navy">
              Physical state <FieldFlag field="physicalState" flags={wizardFlags} />
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(
                [
                  ["solid", "Solid"],
                  ["liquid", "Liquid"],
                  ["sludge", "Sludge"],
                  ["gas", "Gas"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="physicalState"
                    value={value}
                    defaultChecked={defaults.physicalState === value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-brand-navy">
              Hazardous properties <FieldFlag field="isIgnitable" flags={wizardFlags} />
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(
                [
                  ["isIgnitable", "Ignitable", defaults.isIgnitable],
                  ["isCorrosive", "Corrosive", defaults.isCorrosive],
                  ["isReactive", "Reactive", defaults.isReactive],
                  ["isToxic", "Toxic", defaults.isToxic],
                ] as const
              ).map(([name, label, checked]) => (
                <label key={name} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" name={name} defaultChecked={checked} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="mb-1 text-sm font-semibold text-brand-navy">
          Shipment estimate <span className="font-normal text-gray-400">(optional — for LQG biennial report prep)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Input
              id="estimatedContainerCount"
              name="estimatedContainerCount"
              type="number"
              min="0"
              step="1"
              label="Estimated containers per shipment"
              defaultValue={defaults.estimatedContainerCount ?? undefined}
            />
            <div>
              <label htmlFor="defaultContainerTypeCode" className="mb-1 block text-sm font-medium text-brand-navy">
                Default container type code (optional)
              </label>
              <select
                id="defaultContainerTypeCode"
                name="defaultContainerTypeCode"
                defaultValue={defaults.defaultContainerTypeCode ?? ""}
                className={selectStyle}
              >
                <option value="">— None —</option>
                {CONTAINER_TYPE_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Input
              id="estimatedQuantity"
              name="estimatedQuantity"
              type="number"
              min="0"
              step="any"
              label="Estimated quantity per shipment"
              defaultValue={defaults.estimatedQuantity ?? undefined}
              hint="In whatever unit is picked below."
            />
            <div>
              <label htmlFor="defaultUnitCode" className="mb-1 block text-sm font-medium text-brand-navy">
                Default unit code (optional)
              </label>
              <select
                id="defaultUnitCode"
                name="defaultUnitCode"
                defaultValue={defaults.defaultUnitCode ?? ""}
                className={selectStyle}
              >
                <option value="">— None —</option>
                {UNIT_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy">Shipment frequency (optional)</p>
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={shipmentFrequency === opt.value}
              onClick={() => setShipmentFrequency((f) => (f === opt.value ? "" : opt.value))}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                shipmentFrequency === opt.value
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-gray-300 text-brand-navy hover:border-brand-blue"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="shipmentFrequency" value={shipmentFrequency} />
        {shipmentFrequency === "other" && (
          <div className="mt-2">
            <Input
              id="shipmentFrequencyOther"
              name="shipmentFrequencyOther"
              label="Describe the range"
              placeholder="e.g. every 6–8 weeks"
              defaultValue={defaults.shipmentFrequencyOther}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="specificGravity" className="mb-1 block text-sm font-medium text-brand-navy">
          Specific gravity (optional) <FieldFlag field="specificGravity" flags={wizardFlags} />
        </label>
        <div className="flex items-center gap-3">
          <input
            id="specificGravity"
            name="specificGravity"
            type="number"
            min="0"
            step="any"
            placeholder="10.231"
            defaultValue={defaults.specificGravity ?? undefined}
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <span className="text-sm text-gray-500">Water = 1.0</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">For converting a volume estimate to weight, e.g. for biennial reporting.</p>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
          {pending
            ? "Saving…"
            : isWizard
              ? "Save & continue →"
              : mode === "create"
                ? "Save profile"
                : "Save changes"}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline">
          {isWizard ? "Discard this one" : "Cancel"}
        </button>
      </div>
      {!isWizard && state?.success === false && <p className="text-sm text-red-600">❌ {state.error}</p>}
      {isWizard && wizardError && <p className="text-sm text-red-600">❌ {wizardError}</p>}
        </>
      )}
    </form>
  );
}
