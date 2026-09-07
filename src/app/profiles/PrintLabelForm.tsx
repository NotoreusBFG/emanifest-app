"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createLabelPrintAction } from "@/app/actions/labelActions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { WasteProfile } from "@/services/wasteProfileRepository";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Print-time form for one waste profile -- generator info now comes
 * straight off the profile record (set once, at profile-creation time,
 * see src/app/profiles/page.tsx) instead of being re-derived from
 * onboarding and left freely editable -- manifest tracking number
 * (optional, since accumulation usually starts before a manifest exists),
 * line/container reference, and accumulation start date. Submitting
 * snapshots everything into a new label_prints row and navigates to its
 * public /labels/[id] page -- the same page the printed label's QR code
 * points at. */
export function PrintLabelForm({ profile, onCancel }: { profile: WasteProfile; onCancel: () => void }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile.generatorEpaId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-amber-700">
          ⚠️ This profile has no generator assigned (created before profiles required one). Edit the
          profile to assign a generator before printing a label.
        </p>
        <div>
          <Link href="#" onClick={onCancel} className="text-sm text-brand-blue hover:underline">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

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

      <input type="hidden" name="generatorName" value={profile.generatorName} />
      <input type="hidden" name="generatorEpaId" value={profile.generatorEpaId} />
      <input type="hidden" name="generatorAddress" value={profile.generatorAddress} />
      <div className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand-navy">
        <span className="font-semibold">Generator:</span> {profile.generatorName} ({profile.generatorEpaId})
        <br />
        <span className="text-gray-600">{profile.generatorAddress}</span>
      </div>

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
