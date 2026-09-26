"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LabPackGeneratorGate, type SelectedLabPackGenerator } from "@/components/LabPackGeneratorGate";
import {
  isLabPackWizardEnabledForMeAction,
  resolveLocallyAction,
  resolveWithAiAction,
  groupIntoDrumsAction,
  type DrumGroupPreview,
} from "@/app/actions/labPackWizardActions";
import { parseInventoryText, type ParsedInventoryLine } from "@/lib/labPack/parseInventory";
import { createLabPackJobAction, createLabPackAction } from "@/app/actions/labPackActions";
import type { LabPackInput } from "@/lib/labPack/types";
import { shippingName, outerType, drumWeightLb, sizeGal } from "@/lib/labPack/packingRules";

type Step = "paste" | "resolving" | "review" | "saving" | "saved";

/** One drum card's editable state on the review screen -- starts from the
 * grouping engine's suggestion, but every field (including which drum an
 * item belongs to, via the "Combine with…" action) stays human-editable
 * before Save, per the "warn, don't block, review before persist" pattern
 * every AI-adjacent feature in this app already follows. */
interface DraftDrum extends DrumGroupPreview {
  dotShippingDescription: string;
  outerContainerSize: string;
}

function toDraftDrum(d: DrumGroupPreview): DraftDrum {
  const suggestedSize = d.volumeGal > 15 ? "30" : "5";
  const rawDescription = d.isNonHazardous
    ? d.items.every((i) => i.isDotRegulated === false)
      ? "Non DOT, Non RCRA Regulated Materials,none,n/a,n/a"
      : `${d.suggestedContentsLabel} [VERIFY -- confirm real DOT shipping description before finalizing]`
    : `Hazardous Waste, N.O.S. (${d.suggestedContentsLabel}), ${d.wasteCodes.join(", ")}`;
  return {
    ...d,
    outerContainerSize: suggestedSize,
    dotShippingDescription: shippingName(rawDescription, false, !d.isNonHazardous),
  };
}

function WizardBody({ generator }: { generator: SelectedLabPackGenerator }) {
  const [step, setStep] = useState<Step>("paste");
  const [pasteText, setPasteText] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drums, setDrums] = useState<DraftDrum[]>([]);
  const [jobName, setJobName] = useState("");
  const [savedJobId, setSavedJobId] = useState<string | null>(null);

  const runAnalysis = async () => {
    setError(null);
    setStep("resolving");
    try {
      const lines: ParsedInventoryLine[] = parseInventoryText(pasteText);
      if (lines.length === 0) {
        setError("Paste at least one chemical line first.");
        setStep("paste");
        return;
      }

      setProgressNote(`Checking ${lines.length} item(s) against EPA/NLM databases (no AI cost for this step)…`);
      const { resolved, unresolved } = await resolveLocallyAction(lines);

      let aiResolved: typeof resolved = [];
      if (unresolved.length > 0) {
        setProgressNote(`${unresolved.length} item(s) not found locally -- asking AI to characterize them…`);
        const aiResult = await resolveWithAiAction(
          unresolved.map((l) => ({ id: l.id, chemicalName: l.chemicalName, rawLineText: l.rawLineText }))
        );
        if (!aiResult.success) {
          setError(aiResult.error);
          setStep("paste");
          return;
        }
        aiResolved = aiResult.resolved;
      }

      setProgressNote("Grouping into drums…");
      const allItems = [...resolved, ...aiResolved];
      const grouped = await groupIntoDrumsAction(allItems);
      setDrums(grouped.map(toDraftDrum));
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong analyzing this inventory.");
      setStep("paste");
    }
  };

  const combineDrum = (fromIndex: number, intoIndex: number) => {
    if (fromIndex === intoIndex) return;
    setDrums((prev) => {
      const next = [...prev];
      const from = next[fromIndex];
      const into = next[intoIndex];
      const merged: DraftDrum = toDraftDrum({
        ...into,
        items: [...into.items, ...from.items],
        suggestedContentsLabel: [into.suggestedContentsLabel, from.suggestedContentsLabel].join(", "),
      });
      next[intoIndex] = { ...merged, dotShippingDescription: into.dotShippingDescription };
      next.splice(fromIndex, 1);
      return next;
    });
  };

  const updateDrumField = (index: number, patch: Partial<DraftDrum>) => {
    setDrums((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    setError(null);
    setStep("saving");
    const jobResult = await createLabPackJobAction({
      jobName: jobName.trim() || `Segregation Wizard — ${new Date().toLocaleDateString()}`,
      generatorEpaId: generator.epaSiteId,
      generatorName: generator.name,
      generatorAddress: generator.address,
      status: "open",
    });
    if (!jobResult.success) {
      setError(jobResult.error);
      setStep("review");
      return;
    }

    for (const drum of drums) {
      const weight = drumWeightLb(
        `${drum.outerContainerSize}-gal`,
        drum.items.map((i) => [i.chemicalName, i.containerSize, i.physicalState ?? ""] as [string, string, string])
      );
      const input: LabPackInput = {
        jobId: jobResult.job.id,
        jobNumber: jobResult.job.jobNumber,
        generatorEpaId: generator.epaSiteId,
        generatorName: generator.name,
        generatorAddress: generator.address,
        isNonHazardous: drum.isNonHazardous,
        dotShippingDescription: drum.dotShippingDescription,
        dotSpecialPermitNumber: "",
        rqIndicator: false,
        rqCodes: "",
        totalWeight: Math.round(weight),
        outerContainerTypeCode: outerType(`${drum.outerContainerSize}-gal`, drum.dotShippingDescription),
        outerContainerSize: sizeGal(`${drum.outerContainerSize}-gal`),
        drumNumber: null,
        status: "draft",
        lineItems: drum.items.map((item, i) => ({
          lineNumber: i + 1,
          chemicalName: item.chemicalName,
          quantity: item.quantity,
          containerSize: item.containerSize,
          physicalState: item.physicalState,
          epaWasteCodes: item.epaWasteCodes,
          sourceLocation: item.sourceLocation,
          notes: item.notes,
        })),
      };
      const result = await createLabPackAction(input);
      if (!result.success) {
        setError(`Job created, but drum ${drum.drumNumber} failed to save: ${result.error}. Remaining drums were not attempted.`);
        setStep("review");
        return;
      }
    }

    setSavedJobId(jobResult.job.id);
    setStep("saved");
  };

  if (step === "saved" && savedJobId) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-brand-navy">Saved</h2>
        <p className="mb-4 text-sm text-gray-600">
          {drums.length} drum(s) saved to a new lab pack job for {generator.name}.
        </p>
        <Link href={`/lab-packs/jobs/${savedJobId}`} className="text-brand-blue underline">
          View the job →
        </Link>
      </Card>
    );
  }

  if (step === "paste" || step === "resolving") {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold text-brand-navy">1. Paste your chemical inventory</h2>
        <p className="mb-4 text-sm text-gray-600">
          One chemical per line, e.g. &quot;Methanol 27L&quot; or &quot;Iodine crystals x2&quot;. We check EPA/NLM
          databases first (free) and only ask AI about anything we can&apos;t resolve locally.
        </p>
        <textarea
          className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          rows={12}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          disabled={step === "resolving"}
          placeholder={"Methanol 27L\nAcetone 4L\nIodine crystals x2"}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {step === "resolving" && <p className="mt-2 text-sm text-brand-blue">{progressNote}</p>}
        <div className="mt-4">
          <Button onClick={runAnalysis} disabled={step === "resolving" || !pasteText.trim()}>
            {step === "resolving" ? "Analyzing…" : "Analyze inventory"}
          </Button>
        </div>
      </Card>
    );
  }

  // review / saving
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <label className="mb-1 block text-sm font-medium text-brand-navy">Job name</label>
        <input
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder={`Segregation Wizard — ${new Date().toLocaleDateString()}`}
        />
      </Card>

      <Card className="border-l-4 border-amber-400 p-4">
        <p className="text-sm text-brand-navy">
          <strong>Review this drum plan — could any of these be consolidated further before packing?</strong> Every
          drum below is a suggested starting point (from EPA/NLM lookups, AI characterization for anything unresolved,
          and the pack-category rules), not a final answer. Use <em>Combine with…</em> to merge two drums, and edit
          any field before saving. Nothing is written to your lab packs until you click Save below.
        </p>
      </Card>

      {error && (
        <Card className="border-l-4 border-red-500 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {drums.map((drum, index) => (
        <Card key={index} className="p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-navy">Drum {drum.drumNumber}</h3>
              <p className="text-xs text-gray-500">{drum.category.replace(/_/g, " ")}</p>
            </div>
            {drums.length > 1 && (
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                value=""
                onChange={(e) => {
                  const into = Number(e.target.value);
                  if (!Number.isNaN(into)) combineDrum(index, into);
                }}
              >
                <option value="">Combine with…</option>
                {drums.map((other, otherIndex) =>
                  otherIndex === index ? null : (
                    <option key={otherIndex} value={otherIndex}>
                      Drum {other.drumNumber}
                    </option>
                  )
                )}
              </select>
            )}
          </div>

          <label className="mb-1 block text-xs font-medium text-brand-navy">Shipment name</label>
          <input
            className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            value={drum.dotShippingDescription}
            onChange={(e) => updateDrumField(index, { dotShippingDescription: e.target.value })}
          />

          <div className="mb-3 grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="block font-medium text-brand-navy">Waste codes</span>
              <span className="font-mono">{drum.wasteCodes.join(", ") || "none (non-RCRA)"}</span>
            </div>
            <div>
              <span className="block font-medium text-brand-navy">Approx. weight</span>
              <span>
                ~
                {Math.round(
                  drumWeightLb(
                    `${drum.outerContainerSize}-gal`,
                    drum.items.map((i) => [i.chemicalName, i.containerSize, i.physicalState ?? ""] as [string, string, string])
                  )
                )}{" "}
                lb
              </span>
            </div>
            <div>
              <span className="block font-medium text-brand-navy">Suggested size</span>
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                value={drum.outerContainerSize}
                onChange={(e) => updateDrumField(index, { outerContainerSize: e.target.value })}
              >
                {["5", "15", "30", "55"].map((g) => (
                  <option key={g} value={g}>
                    {g}-gal
                  </option>
                ))}
              </select>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1 pr-2">Chemical</th>
                <th className="py-1 pr-2">Size</th>
                <th className="py-1 pr-2">State</th>
                <th className="py-1 pr-2">Codes / notes</th>
              </tr>
            </thead>
            <tbody>
              {drum.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">{item.chemicalName}</td>
                  <td className="py-1 pr-2">{item.containerSize || "—"}</td>
                  <td className="py-1 pr-2">{item.physicalState ?? "—"}</td>
                  <td className="py-1 pr-2">
                    <span className="font-mono">{item.epaWasteCodes.join("; ")}</span>
                    {item.notes && <span className="block text-gray-400">{item.notes}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {drum.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-amber-700">
              {drum.warnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={step === "saving" || drums.length === 0}>
          {step === "saving" ? "Saving…" : `Save ${drums.length} drum(s)`}
        </Button>
        <Button variant="secondary" onClick={() => setStep("paste")} disabled={step === "saving"}>
          Start over
        </Button>
      </div>
    </div>
  );
}

export default function LabPackWizardPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    isLabPackWizardEnabledForMeAction().then(setEnabled);
  }, []);

  if (enabled === null) return null;
  if (!enabled) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm text-gray-600">
            The Segregation Wizard isn&apos;t enabled for your account yet.{" "}
            <Link href="/lab-packs" className="text-brand-blue underline">
              Back to Lab Packs
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-navy">Segregation Wizard</h1>
        <Link href="/lab-packs" className="text-sm text-brand-blue underline">
          ← Back to Lab Packs
        </Link>
      </div>
      <LabPackGeneratorGate>{(generator) => <WizardBody generator={generator} />}</LabPackGeneratorGate>
    </div>
  );
}
