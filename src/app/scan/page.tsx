"use client";

import { Suspense, useActionState, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loadManifestForScanAction,
  submitScanWasteLinesAction,
  type SubmitScanWasteLinesState,
} from "@/app/actions/scanAddWasteLinesActions";
import { listWasteProfilesForUserAction } from "@/app/actions/wasteProfileActions";
import { listLabPacksForUserAction, listLabPackJobsForUserAction } from "@/app/actions/labPackActions";
import {
  ManifestFieldsForm,
  BLANK_HANDLER,
  emptyWasteLine,
  type HandlerFormState,
  type TransporterFormState,
  type WasteLineFormState,
} from "@/app/manifests/new/ManifestFieldsForm";
import { Card } from "@/components/ui/Card";
import { inputStyle, primaryButtonStyle } from "@/lib/formStyles";
import { brand } from "@/lib/brandColors";
import { BackButton } from "@/components/BackButton";
import type { MirroredManifestForDisplay } from "@/services/manifestRepository";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";

/**
 * Owner-facing tool: enter an MTN for a manifest already saved with zero
 * waste lines (the normal /manifests/new "save with no wastes yet" path),
 * scan the drums going on it, and upload the aggregated lines straight to
 * EPA — no separate paper waste-line worksheet needed before signing. See
 * private-notes/plan/ios-capacitor-app-plan.md for the longer-term native/
 * PWA framing this prototype feeds into.
 */
// useSearchParams() (for the ?mtn= deep link from the dashboard's "Scan
// drums" card button) requires a Suspense boundary in the App Router, or
// the build fails — same pattern as ManifestLookupPageClient.tsx.
export default function ScanAddWasteLinesPage() {
  return (
    <Suspense fallback={null}>
      <ScanAddWasteLinesPageInner />
    </Suspense>
  );
}

function ScanAddWasteLinesPageInner() {
  const [mtn, setMtn] = useState("");
  const [manifest, setManifest] = useState<MirroredManifestForDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleLoad = useCallback(async (mtnToLoad: string) => {
    setLoading(true);
    setLoadError(null);
    const result = await loadManifestForScanAction(mtnToLoad);
    setLoading(false);
    if (!result.success) {
      setLoadError(result.error);
      setManifest(null);
      return;
    }
    setManifest(result.manifest);
  }, []);

  // Deep link from a dashboard card's "Scan drums" button (/scan?mtn=...)
  // — loads straight in, same as the manual MTN-entry path, so the card
  // that was clicked determines which manifest the scan uploads to instead
  // of the user re-typing/pasting the MTN by hand.
  const searchParams = useSearchParams();
  const deepLinkMtn = searchParams.get("mtn");
  useEffect(() => {
    if (deepLinkMtn) {
      setMtn(deepLinkMtn);
      handleLoad(deepLinkMtn);
    }
  }, [deepLinkMtn, handleLoad]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold" style={{ color: brand.navy }}>
        Scan drums → add waste lines
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        For a manifest you already saved with no waste lines. Enter its tracking number, scan each
        drum&apos;s printed label, then upload — scanning another drum of the same waste just adds to
        that line&apos;s container count instead of creating a duplicate.
      </p>

      <Card className="mt-4 p-4">
        <label className="mb-1 block text-sm font-medium">Manifest tracking number (MTN)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={mtn}
            onChange={(e) => {
              setMtn(e.target.value);
              setManifest(null);
            }}
            placeholder="e.g. 100097421ELC"
            style={{ ...inputStyle, maxWidth: "260px" }}
          />
          <button
            type="button"
            onClick={() => handleLoad(mtn)}
            disabled={loading || !mtn.trim()}
            style={primaryButtonStyle(loading || !mtn.trim())}
          >
            {loading ? "Loading…" : "Load manifest"}
          </button>
        </div>
        {loadError && <p className="mt-2 text-sm text-red-600">❌ {loadError}</p>}
      </Card>

      {manifest && <ScanWasteLinesForm mtn={manifest.manifestTrackingNumber} manifest={manifest} />}

      <p className="mt-6 text-xs text-gray-500">
        <BackButton fallbackHref="/dashboard" label="← Back to dashboard" className="hover:underline" />
      </p>
    </div>
  );
}

function ScanWasteLinesForm({ mtn, manifest }: { mtn: string; manifest: MirroredManifestForDisplay }) {
  const [wasteLines, setWasteLines] = useState<WasteLineFormState[]>([
    emptyWasteLine(0, false),
    emptyWasteLine(1, false),
    emptyWasteLine(2, false),
    emptyWasteLine(3, false),
  ]);

  const [profiles, setProfiles] = useState<WasteProfile[]>([]);
  useEffect(() => {
    listWasteProfilesForUserAction().then(setProfiles);
  }, []);

  const [labPacks, setLabPacks] = useState<LabPack[]>([]);
  useEffect(() => {
    listLabPacksForUserAction().then((packs) => setLabPacks(packs.filter((p) => !p.epaMtn)));
  }, []);

  const [labPackJobs, setLabPackJobs] = useState<LabPackJob[]>([]);
  useEffect(() => {
    listLabPackJobsForUserAction().then((jobs) => setLabPackJobs(jobs.filter((j) => j.status !== "linked")));
  }, []);

  const generator: HandlerFormState = { ...BLANK_HANDLER, name: manifest.generator.name, epaSiteId: manifest.generator.epaSiteId };
  const facility: HandlerFormState = {
    ...BLANK_HANDLER,
    name: manifest.designatedFacility.name,
    epaSiteId: manifest.designatedFacility.epaSiteId,
  };
  const transporters: TransporterFormState[] = manifest.transporters.map((t, i) => ({
    id: i,
    epaSiteId: t.epaSiteId,
    name: t.name,
  }));

  const boundAction = useCallback(
    (prevState: SubmitScanWasteLinesState, formData: FormData) => submitScanWasteLinesAction(mtn, prevState, formData),
    [mtn]
  );
  const [state, formAction, isPending] = useActionState<SubmitScanWasteLinesState, FormData>(boundAction, null);

  if (state?.success) {
    return (
      <Card className="mt-4 p-4">
        <p className="text-sm font-medium" style={{ color: "#2a8a4a" }}>
          ✅ Uploaded — {state.wasteLineCount} waste line(s) now on manifest {mtn}.
        </p>
        {state.warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
            {state.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <Link href={`/manifests?mtn=${encodeURIComponent(mtn)}`} className="mt-3 inline-block text-sm text-brand-blue hover:underline">
          Review manifest {mtn} →
        </Link>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-4">
      <p className="text-sm text-gray-600">
        <strong>{manifest.generator.name || manifest.generator.epaSiteId}</strong> →{" "}
        <strong>{manifest.designatedFacility.name || manifest.designatedFacility.epaSiteId}</strong>. The generator,
        transporter(s), and disposal facility can&apos;t be changed here.
      </p>
      <form action={formAction}>
        <ManifestFieldsForm
          generator={generator}
          setGenerator={() => {}}
          facility={facility}
          setFacility={() => {}}
          transporters={transporters}
          setTransporters={() => {}}
          wasteLines={wasteLines}
          setWasteLines={setWasteLines}
          agencyAuthorityGranted={false}
          setAgencyAuthorityGranted={() => {}}
          handlingInstructions=""
          setHandlingInstructions={() => {}}
          defaultEmergencyPhone=""
          wasteProfiles={profiles}
          labPacks={labPacks}
          labPackJobs={labPackJobs}
          mode="wasteLinesOnly"
        />

        <button type="submit" disabled={isPending} style={{ ...primaryButtonStyle(isPending), marginTop: "16px" }}>
          {isPending ? "Uploading…" : "Upload to manifest"}
        </button>

        {state && !state.success && <p className="mt-2 text-sm text-red-600">❌ {state.error}</p>}
      </form>
    </Card>
  );
}
