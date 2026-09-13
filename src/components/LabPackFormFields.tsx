"use client";

import { useEffect, useRef, useState } from "react";
import { createLabPackAction, updateLabPackAction } from "@/app/actions/labPackActions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChemicalNameSearchField } from "@/components/ChemicalNameSearchField";
import { CONTAINER_TYPE_CODES } from "@/lib/rcrainfo/manifestCodes";
import { OUTER_CONTAINER_SIZE_OPTIONS, PHYSICAL_STATE_OPTIONS } from "@/lib/labPack/types";
import type { LabPack, LabPackInput, LabPackLineItemInput, PhysicalState } from "@/lib/labPack/types";

const selectStyle =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue bg-white";

interface LineItemRow {
  key: string;
  lineNumber: number;
  chemicalName: string;
  quantity: string;
  containerSize: string;
  physicalState: PhysicalState | null;
  epaWasteCodesText: string;
  sourceLocation: string;
  notes: string;
}

function emptyRow(lineNumber: number): LineItemRow {
  return {
    key: crypto.randomUUID(),
    lineNumber,
    chemicalName: "",
    quantity: "",
    containerSize: "",
    physicalState: null,
    epaWasteCodesText: "",
    sourceLocation: "",
    notes: "",
  };
}

export interface ChemicalQuickAddFields {
  chemicalName: string;
  epaWasteCodesText: string;
  quantity: string;
  containerSize: string;
  physicalState: PhysicalState | null;
  sourceLocation: string;
}

function emptyQuickAddFields(): ChemicalQuickAddFields {
  return { chemicalName: "", epaWasteCodesText: "", quantity: "", containerSize: "", physicalState: null, sourceLocation: "" };
}

/**
 * Quick-add modal for the "standing at a bench packing drums" workflow --
 * captures a whole line item in one shot, then stays open with the fields
 * cleared and refocused for the next chemical. Fields stay editable inline
 * in the list below afterward too, for a correction without reopening this.
 */
function ChemicalQuickAddModal({
  onSave,
  onClose,
}: {
  onSave: (fields: ChemicalQuickAddFields) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<ChemicalQuickAddFields>(emptyQuickAddFields());
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const update = (patch: Partial<ChemicalQuickAddFields>) => setFields((f) => ({ ...f, ...patch }));

  const handleSave = () => {
    const name = fields.chemicalName.trim();
    if (!name) {
      setError("Enter a chemical name.");
      return;
    }
    onSave({ ...fields, chemicalName: name });
    setFields(emptyQuickAddFields());
    setError(null);
    nameInputRef.current?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/50 p-5"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-navy">Add a chemical</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <ChemicalNameSearchField
            ref={nameInputRef}
            value={fields.chemicalName}
            onChange={(name) => update({ chemicalName: name })}
            onSelectCodes={(codesText) => update({ epaWasteCodesText: codesText })}
          />
          <Input
            label="EPA waste code(s)"
            placeholder="D001, F003"
            value={fields.epaWasteCodesText}
            onChange={(e) => update({ epaWasteCodesText: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Qty"
              inputMode="numeric"
              value={fields.quantity}
              onChange={(e) => update({ quantity: e.target.value })}
            />
            <Input
              label="Size"
              placeholder="4L"
              value={fields.containerSize}
              onChange={(e) => update({ containerSize: e.target.value })}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-navy">State</label>
              <select
                className={selectStyle}
                value={fields.physicalState ?? ""}
                onChange={(e) => update({ physicalState: (e.target.value || null) as PhysicalState | null })}
              >
                <option value="">—</option>
                {PHYSICAL_STATE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Note"
            value={fields.sourceLocation}
            onChange={(e) => update({ sourceLocation: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-1 flex gap-3">
            <Button type="submit" className="px-4 py-2 text-sm">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="px-4 py-2 text-sm">
              Close
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LabPackFormFields({
  mode,
  labPack,
  generator,
  jobId,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  labPack?: LabPack;
  /** Fixed generator for a new drum, passed down from the parent job --
   * generator selection now happens once at the job level (see
   * LabPackGeneratorGate), not per drum. Omit for `mode="edit"`, where the
   * drum's own already-set generator fields are used instead. */
  generator?: { epaSiteId: string; name: string; address: string };
  /** The lab_pack_jobs batch this drum is being created under. Omit (or
   * pass null/undefined) for a legacy/ungrouped drum. */
  jobId?: string | null;
  onDone: (labPack: LabPack) => void;
  onCancel: () => void;
}) {
  const [poNumber, setPoNumber] = useState(labPack?.jobNumber ?? "");
  const [drumNumber, setDrumNumber] = useState(labPack?.drumNumber != null ? String(labPack.drumNumber) : "");
  const [isNonHazardous, setIsNonHazardous] = useState(labPack?.isNonHazardous ?? false);
  const [dotShippingDescription, setDotShippingDescription] = useState(labPack?.dotShippingDescription ?? "");
  const [dotSpecialPermitNumber, setDotSpecialPermitNumber] = useState(labPack?.dotSpecialPermitNumber ?? "");
  const [rqIndicator, setRqIndicator] = useState(labPack?.rqIndicator ?? false);
  const [rqCodes, setRqCodes] = useState(labPack?.rqCodes ?? "");
  const [totalWeight, setTotalWeight] = useState(labPack?.totalWeight != null ? String(labPack.totalWeight) : "");
  const [outerContainerTypeCode, setOuterContainerTypeCode] = useState(labPack?.outerContainerTypeCode ?? "DM");
  const [outerContainerSize, setOuterContainerSize] = useState(labPack?.outerContainerSize ?? "");
  const [headerOpen, setHeaderOpen] = useState(mode === "create");

  const generatorEpaId = labPack?.generatorEpaId ?? generator?.epaSiteId ?? "";
  const generatorName = labPack?.generatorName ?? generator?.name ?? "";
  const generatorAddress = labPack?.generatorAddress ?? generator?.address ?? "";
  const effectiveJobId = mode === "create" ? (jobId ?? null) : (labPack?.jobId ?? null);

  const initialRows: LineItemRow[] =
    labPack?.lineItems.map((item) => ({
      key: item.id,
      lineNumber: item.lineNumber,
      chemicalName: item.chemicalName,
      quantity: item.quantity != null ? String(item.quantity) : "",
      containerSize: item.containerSize,
      physicalState: item.physicalState,
      epaWasteCodesText: item.epaWasteCodes.join(", "),
      sourceLocation: item.sourceLocation,
      notes: item.notes,
    })) ?? [];
  const [rows, setRows] = useState<LineItemRow[]>(initialRows);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const updateRow = (key: string, patch: Partial<LineItemRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleQuickAddSave = (fields: ChemicalQuickAddFields) => {
    setRows((prev) => [...prev, { ...emptyRow(prev.length + 1), ...fields }]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key).map((r, i) => ({ ...r, lineNumber: i + 1 })));
  };

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    const lineItems: LabPackLineItemInput[] = rows
      .filter((r) => r.chemicalName.trim() !== "")
      .map((r) => ({
        lineNumber: r.lineNumber,
        chemicalName: r.chemicalName.trim(),
        quantity: r.quantity.trim() === "" ? null : Number(r.quantity),
        containerSize: r.containerSize.trim(),
        physicalState: r.physicalState,
        epaWasteCodes: r.epaWasteCodesText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        sourceLocation: r.sourceLocation.trim(),
        notes: r.notes.trim(),
      }));

    if (lineItems.length === 0) {
      setError("Add at least one chemical to the lab pack.");
      return;
    }
    if (!isNonHazardous && !generatorEpaId) {
      setError("Select a generator site.");
      return;
    }

    const input: LabPackInput = {
      jobId: effectiveJobId,
      jobNumber: poNumber.trim(),
      generatorEpaId,
      generatorName,
      generatorAddress,
      isNonHazardous,
      dotShippingDescription: dotShippingDescription.trim(),
      dotSpecialPermitNumber: dotSpecialPermitNumber.trim(),
      rqIndicator,
      rqCodes: rqCodes.trim(),
      totalWeight: totalWeight.trim() === "" ? null : Number(totalWeight),
      outerContainerTypeCode,
      outerContainerSize,
      drumNumber: drumNumber.trim() === "" ? null : Number(drumNumber),
      status: "draft",
      lineItems,
    };

    setPending(true);
    const result = mode === "create" ? await createLabPackAction(input) : await updateLabPackAction(labPack!.id, input);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onDone(result.labPack);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drum header -- collapsible on mobile so the line-item list (used
          repeatedly while packing) stays in view without re-scrolling past
          these fields each time. */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setHeaderOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-brand-navy"
        >
          Drum details
          <span className="text-gray-400">{headerOpen ? "▲" : "▼"}</span>
        </button>
        {headerOpen && (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4">
            {generatorEpaId && (
              <div className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand-navy">
                Generator: {generatorName} ({generatorEpaId})
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNonHazardous}
                onChange={(e) => setIsNonHazardous(e.target.checked)}
                className="h-5 w-5"
              />
              Non-hazardous lab pack
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="PO / work order #"
                hint="The third party's own reference number, if any -- separate from this job's LP number."
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
              <Input
                label="Drum #"
                inputMode="numeric"
                value={drumNumber}
                onChange={(e) => setDrumNumber(e.target.value)}
              />
            </div>

            {!isNonHazardous && (
              <>
                <Input
                  label="DOT shipping description"
                  hint="Proper shipping name + hazard class(es) + packing group for this whole drum, e.g. UN1993, Flammable liquids, n.o.s., 3, PG II"
                  value={dotShippingDescription}
                  onChange={(e) => setDotShippingDescription(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="DOT special permit #"
                    value={dotSpecialPermitNumber}
                    onChange={(e) => setDotSpecialPermitNumber(e.target.value)}
                  />
                  <div>
                    <label className="mb-1 flex items-center gap-2 text-sm font-medium text-brand-navy">
                      <input
                        type="checkbox"
                        checked={rqIndicator}
                        onChange={(e) => setRqIndicator(e.target.checked)}
                        className="h-5 w-5"
                      />
                      RQ (reportable quantity)
                    </label>
                    {rqIndicator && (
                      <Input placeholder="RQ codes" value={rqCodes} onChange={(e) => setRqCodes(e.target.value)} />
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-navy">Outer container type</label>
                <select
                  className={selectStyle}
                  value={outerContainerTypeCode}
                  onChange={(e) => setOuterContainerTypeCode(e.target.value)}
                >
                  {CONTAINER_TYPE_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-navy">Outer container size</label>
                <select
                  className={selectStyle}
                  value={outerContainerSize}
                  onChange={(e) => setOuterContainerSize(e.target.value)}
                >
                  <option value="">—</option>
                  {OUTER_CONTAINER_SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "PIH" ? "PIH (special handling)" : `${s} gal`}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Total weight (lb)"
                inputMode="decimal"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Line items -- card layout on mobile, table at md:+. New chemicals
          come in one at a time via the quick-add modal below; the fields
          here (qty/size/state/source/notes) stay inline-editable once
          added. */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-brand-navy">Chemicals in this drum</h3>

        {rows.length === 0 && (
          <p className="text-sm text-gray-500">No chemicals added yet -- click + Add chemical to start.</p>
        )}

        {rows.length > 0 && (
          <>
            <div className="hidden md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Chemical name</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Container size</th>
                    <th className="pb-2">State</th>
                    <th className="pb-2">EPA waste code(s)</th>
                    <th className="pb-2">Note</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-gray-100">
                      <td className="py-2 pr-2 text-gray-500">{row.lineNumber}</td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.chemicalName}
                          onChange={(e) => updateRow(row.key, { chemicalName: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          inputMode="numeric"
                          className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.quantity}
                          onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          placeholder="4L"
                          value={row.containerSize}
                          onChange={(e) => updateRow(row.key, { containerSize: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.physicalState ?? ""}
                          onChange={(e) => updateRow(row.key, { physicalState: (e.target.value || null) as PhysicalState | null })}
                        >
                          <option value="">—</option>
                          {PHYSICAL_STATE_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          placeholder="D001, F003"
                          value={row.epaWasteCodesText}
                          onChange={(e) => updateRow(row.key, { epaWasteCodesText: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.sourceLocation}
                          onChange={(e) => updateRow(row.key, { sourceLocation: e.target.value })}
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {rows.map((row) => (
                <div key={row.key} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">Item {row.lineNumber}</span>
                    <button type="button" onClick={() => removeRow(row.key)} className="text-xs text-red-600">
                      Remove
                    </button>
                  </div>
                  <input
                    placeholder="Chemical name"
                    className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base"
                    value={row.chemicalName}
                    onChange={(e) => updateRow(row.key, { chemicalName: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      inputMode="numeric"
                      placeholder="Qty"
                      className="rounded-md border border-gray-300 px-3 py-2.5 text-base"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    />
                    <input
                      placeholder="Size (4L)"
                      className="rounded-md border border-gray-300 px-3 py-2.5 text-base"
                      value={row.containerSize}
                      onChange={(e) => updateRow(row.key, { containerSize: e.target.value })}
                    />
                    <select
                      className="rounded-md border border-gray-300 px-3 py-2.5 text-base"
                      value={row.physicalState ?? ""}
                      onChange={(e) => updateRow(row.key, { physicalState: (e.target.value || null) as PhysicalState | null })}
                    >
                      <option value="">State —</option>
                      {PHYSICAL_STATE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Waste code(s)"
                      className="rounded-md border border-gray-300 px-3 py-2.5 text-base"
                      value={row.epaWasteCodesText}
                      onChange={(e) => updateRow(row.key, { epaWasteCodesText: e.target.value })}
                    />
                    <input
                      placeholder="Note"
                      className="col-span-2 rounded-md border border-gray-300 px-3 py-2.5 text-base"
                      value={row.sourceLocation}
                      onChange={(e) => updateRow(row.key, { sourceLocation: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="rounded-full border-2 border-brand-blue px-5 py-3 text-sm font-semibold text-brand-blue hover:bg-brand-tint"
        >
          + Add chemical
        </button>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-600">
        Packing certification: I authorize that the material packaged in this container, including all inventory
        sheets, is exactly as identified above; contains no radioactive, biohazardous, PCB-containing,
        temperature-controlled, or potentially explosive materials; and has been packed in accordance with all
        applicable DOT, EPA, TSCA, and state/local regulations.
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Saving…" : "Save lab pack"}
        </Button>
        <Button variant="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
      </div>

      {quickAddOpen && <ChemicalQuickAddModal onSave={handleQuickAddSave} onClose={() => setQuickAddOpen(false)} />}
    </div>
  );
}
