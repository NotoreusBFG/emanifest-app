"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLabelPrintAction } from "@/app/actions/labelActions";
import { getOnboardingProgressAction } from "@/app/actions/onboardingActions";
import { getSiteDetailsAction } from "@/app/actions/manifestActions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { WasteProfile } from "@/services/wasteProfileRepository";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Print-time form for one waste profile -- generator info, manifest
 * tracking number (optional, since accumulation usually starts before a
 * manifest exists), line/container reference, and accumulation start
 * date. Submitting snapshots everything into a new label_prints row and
 * navigates to its public /labels/[id] page -- the same page the printed
 * label's QR code points at. */
export function PrintLabelForm({ profile, onCancel }: { profile: WasteProfile; onCancel: () => void }) {
  const router = useRouter();
  const [generatorName, setGeneratorName] = useState("");
  const [generatorAddress, setGeneratorAddress] = useState("");
  const [generatorEpaId, setGeneratorEpaId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time prefill from the account's own EPA ID (same source used to
  // prefill the generator on /manifests/new) -- editable afterward.
  useEffect(() => {
    getOnboardingProgressAction().then((progress) => {
      const epaId = progress?.epaIdNumber?.trim();
      if (!epaId) return;
      getSiteDetailsAction(epaId).then((result) => {
        if (!result.success) return;
        setGeneratorName(result.site.name);
        setGeneratorEpaId(result.site.epaSiteId);
        const addr = result.site.siteAddress;
        if (addr) {
          setGeneratorAddress(
            [addr.address1, addr.city, addr.state?.code, addr.zip].filter(Boolean).join(", ")
          );
        }
      });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("wasteProfileId", profile.id);
    const result = await createLabelPrintAction(formData);
    setIsPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/labels/${result.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Printing a label for <b>{profile.profileName}</b> ({profile.mmProfileNumber}). Fields below are for
        this one printed label, not saved back to the profile.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="generatorName"
          name="generatorName"
          label="Generator name"
          required
          value={generatorName}
          onChange={(e) => setGeneratorName(e.target.value)}
        />
        <Input
          id="generatorEpaId"
          name="generatorEpaId"
          label="Generator EPA ID"
          required
          value={generatorEpaId}
          onChange={(e) => setGeneratorEpaId(e.target.value)}
        />
      </div>
      <Input
        id="generatorAddress"
        name="generatorAddress"
        label="Generator address"
        required
        value={generatorAddress}
        onChange={(e) => setGeneratorAddress(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="accumulationStartDate" className="mb-1 block text-sm font-medium text-brand-navy">
            Accumulation start date
          </label>
          <input
            id="accumulationStartDate"
            name="accumulationStartDate"
            type="date"
            required
            defaultValue={today()}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        <Input id="lineReference" name="lineReference" label="Line / container (optional)" placeholder="e.g. 1 of 1" />
      </div>
      <Input
        id="manifestTrackingNumber"
        name="manifestTrackingNumber"
        label="Manifest tracking number (optional)"
        hint="Leave blank if this drum is still accumulating and hasn't shipped yet."
      />

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending} className="px-4 py-2 text-sm">
          {isPending ? "Generating…" : "Generate label"}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">❌ {error}</p>}
    </form>
  );
}
