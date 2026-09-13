"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createLabPackJobAction,
  deleteLabPackAction,
  listLabPackJobsForGeneratorAction,
  listLabPacksForUserAction,
} from "@/app/actions/labPackActions";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LabPackFormFields } from "@/components/LabPackFormFields";
import { LabPackGeneratorGate, type SelectedLabPackGenerator } from "@/components/LabPackGeneratorGate";

function jobStatusBadge(status: LabPackJob["status"]) {
  switch (status) {
    case "linked":
      return "bg-emerald-100 text-emerald-700";
    case "ready":
      return "bg-sky-100 text-sky-700";
    case "archived":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function drumStatusBadge(status: LabPack["status"]) {
  return status === "finalized" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

/** Job list + "legacy" ungrouped drums for one generator, once
 * LabPackGeneratorGate has resolved a selection. */
function JobsForGenerator({ generator }: { generator: SelectedLabPackGenerator }) {
  const [jobs, setJobs] = useState<LabPackJob[] | null>(null);
  const [legacyPacks, setLegacyPacks] = useState<LabPack[] | null>(null);
  const [newJobName, setNewJobName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLegacyId, setEditingLegacyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => {
    listLabPackJobsForGeneratorAction(generator.epaSiteId).then(setJobs);
    // Legacy/ungrouped drums are just this generator's lab_packs rows with
    // no job -- reuses the same listing every other lab-pack view already
    // fetches rather than adding a narrower server action for this slice.
    listLabPacksForUserAction().then((packs) =>
      setLegacyPacks(packs.filter((p) => !p.jobId && p.generatorEpaId === generator.epaSiteId))
    );
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the gated generator changes
  }, [generator.epaSiteId]);

  const handleCreateJob = async () => {
    if (!newJobName.trim()) {
      setError("Name the job first.");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createLabPackJobAction({
      jobName: newJobName.trim(),
      generatorEpaId: generator.epaSiteId,
      generatorName: generator.name,
      generatorAddress: generator.address,
      status: "open",
    });
    setCreating(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNewJobName("");
    refresh();
  };

  const handleDeleteLegacy = async (id: string) => {
    if (!confirm("Delete this lab pack? This can't be undone.")) return;
    setDeletingId(id);
    await deleteLabPackAction(id);
    setDeletingId(null);
    refresh();
  };

  return (
    <>
      <Card className="p-6">
        <p className="mb-3 text-sm font-semibold text-brand-navy">Start a new job</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-w-xs flex-1">
            <Input
              label="Job name"
              placeholder="e.g. Acme Labs Cleanout"
              value={newJobName}
              onChange={(e) => setNewJobName(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateJob} disabled={creating} className="px-4 py-2 text-sm">
            {creating ? "Creating…" : "+ New job"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {jobs === null && <p className="text-sm text-gray-500">Loading jobs…</p>}
        {jobs?.length === 0 && <p className="text-sm text-gray-500">No jobs yet for this generator.</p>}
        {jobs?.map((job) => (
          <Link key={job.id} href={`/lab-packs/jobs/${job.id}`}>
            <Card className="p-4 transition hover:shadow-[0_2px_16px_rgba(10,34,70,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    {job.jobNumber} — {job.jobName || "Untitled job"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {job.drumCount} drum{job.drumCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${jobStatusBadge(job.status)}`}>
                  {job.status}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {legacyPacks !== null && legacyPacks.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-brand-navy">Legacy / ungrouped packing slips</h2>
          <div className="flex flex-col gap-4">
            {legacyPacks.map((p) =>
              editingLegacyId === p.id ? (
                <Card key={p.id} className="p-6">
                  <LabPackFormFields
                    mode="edit"
                    labPack={p}
                    onDone={() => {
                      setEditingLegacyId(null);
                      refresh();
                    }}
                    onCancel={() => setEditingLegacyId(null)}
                  />
                </Card>
              ) : (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-brand-navy">
                          Drum {p.drumNumber ?? "—"} {p.jobNumber && `· PO ${p.jobNumber}`}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${drumStatusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-700">
                        {p.isNonHazardous ? "Non-hazardous" : p.dotShippingDescription || "No DOT description yet"}
                      </p>
                      {p.wasteCodes.length > 0 && (
                        <p className="mt-0.5 text-xs text-gray-500">Waste codes: {p.wasteCodes.join(", ")}</p>
                      )}
                      {p.epaMtn && (
                        <p className="mt-1 text-xs text-gray-500">
                          Linked to manifest {p.epaMtn}, line {p.manifestLineNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-sm sm:flex-row sm:items-center">
                      <Link href={`/lab-packs/${p.id}`} className="font-medium text-brand-blue">
                        Print
                      </Link>
                      <button type="button" onClick={() => setEditingLegacyId(p.id)} className="font-medium text-brand-blue">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLegacy(p.id)}
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
      )}
    </>
  );
}

export default function LabPacksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Lab packs</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Group a batch of drums into a job for one customer, build a packing list for each drum,
            then bulk-load the whole job onto a manifest when you&apos;re ready to ship. Codes flow
            through to the LDR notice automatically as a lab pack (40 CFR 268.42(c)).
          </p>
        </div>
        <Link href="/manifests/new" className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline">
          ← Create a manifest
        </Link>
      </div>

      <LabPackGeneratorGate>{(generator) => <JobsForGenerator generator={generator} />}</LabPackGeneratorGate>
    </div>
  );
}
