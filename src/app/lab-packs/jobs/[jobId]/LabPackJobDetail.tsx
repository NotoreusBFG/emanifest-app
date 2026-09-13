"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getLabPackJobAction,
  listLabPacksForJobAction,
  listLabPackJobsForGeneratorAction,
  deleteLabPackJobAction,
  deleteLabPackAction,
  duplicateLabPackAction,
} from "@/app/actions/labPackActions";
import type { LabPack, LabPackJob } from "@/lib/labPack/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LabPackFormFields } from "@/components/LabPackFormFields";

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

/** Inline "copy this drum's chemical list into another job" picker --
 * either an existing job for the same generator, or a brand-new one named
 * on the spot. Kept collapsed by default per drum card since it's a less
 * common action than editing/deleting. */
function CopyToJobPicker({
  drum,
  otherJobs,
  onDone,
}: {
  drum: LabPack;
  otherJobs: LabPackJob[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetJobId, setTargetJobId] = useState("");
  const [newJobName, setNewJobName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    setError(null);
    if (!targetJobId && !newJobName.trim()) {
      setError("Pick a job or name a new one.");
      return;
    }
    setPending(true);
    const result = await duplicateLabPackAction(
      drum.id,
      targetJobId ? { jobId: targetJobId } : { newJobName: newJobName.trim() }
    );
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setTargetJobId("");
    setNewJobName("");
    onDone();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand-blue">
        Copy to job…
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
      <select
        value={targetJobId}
        onChange={(e) => {
          setTargetJobId(e.target.value);
          if (e.target.value) setNewJobName("");
        }}
        className="rounded-md border border-gray-300 px-2 py-1"
      >
        <option value="">— New job —</option>
        {otherJobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.jobNumber} — {j.jobName || "Untitled"}
          </option>
        ))}
      </select>
      {!targetJobId && (
        <input
          placeholder="New job name"
          value={newJobName}
          onChange={(e) => setNewJobName(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
      )}
      <button type="button" onClick={handleCopy} disabled={pending} className="font-medium text-brand-blue disabled:opacity-50">
        {pending ? "Copying…" : "Confirm"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-gray-500">
        Cancel
      </button>
      {error && <span className="w-full text-red-600">{error}</span>}
    </div>
  );
}

export function LabPackJobDetail({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<LabPackJob | null | undefined>(undefined);
  const [drums, setDrums] = useState<LabPack[] | null>(null);
  const [otherJobs, setOtherJobs] = useState<LabPackJob[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshDrums = () => {
    listLabPacksForJobAction(jobId).then(setDrums);
  };

  useEffect(() => {
    getLabPackJobAction(jobId).then(setJob);
    refreshDrums();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when navigating to a different job
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    listLabPackJobsForGeneratorAction(job.generatorEpaId).then((jobs) =>
      setOtherJobs(jobs.filter((j) => j.id !== job.id))
    );
  }, [job]);

  const handleDeleteDrum = async (id: string) => {
    if (!confirm("Delete this lab pack? This can't be undone.")) return;
    setDeletingId(id);
    await deleteLabPackAction(id);
    setDeletingId(null);
    refreshDrums();
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    if (!confirm(`Delete job ${job.jobNumber}? Its drums become ungrouped, not deleted.`)) return;
    await deleteLabPackJobAction(job.id);
    router.push("/lab-packs");
  };

  if (job === undefined || drums === null) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-sm text-red-600">Job not found.</p>
        <Link href="/lab-packs" className="text-sm font-medium text-brand-blue">
          ← Back to lab packs
        </Link>
      </div>
    );
  }

  const generator = { epaSiteId: job.generatorEpaId, name: job.generatorName, address: job.generatorAddress };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/lab-packs" className="text-sm font-medium text-brand-blue hover:underline">
        ← All jobs
      </Link>

      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-brand-navy">
              {job.jobNumber} — {job.jobName || "Untitled job"}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${jobStatusBadge(job.status)}`}>
              {job.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Generator: {job.generatorName} ({job.generatorEpaId})
          </p>
        </div>
        <button type="button" onClick={handleDeleteJob} className="text-sm font-medium text-red-600">
          Delete job
        </button>
      </div>

      <Card className="p-6">
        {!showCreate ? (
          <Button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm">
            + New lab pack
          </Button>
        ) : (
          <LabPackFormFields
            mode="create"
            generator={generator}
            jobId={job.id}
            onDone={() => {
              setShowCreate(false);
              refreshDrums();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </Card>

      <div className="mt-4 flex flex-col gap-4">
        {drums.length === 0 && <p className="text-sm text-gray-500">No drums in this job yet.</p>}
        {drums.map((p) =>
          editingId === p.id ? (
            <Card key={p.id} className="p-6">
              <LabPackFormFields
                mode="edit"
                labPack={p}
                onDone={() => {
                  setEditingId(null);
                  refreshDrums();
                }}
                onCancel={() => setEditingId(null)}
              />
            </Card>
          ) : (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy">Drum {p.drumNumber ?? "—"}</p>
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
                  <div className="mt-2">
                    <CopyToJobPicker drum={p} otherJobs={otherJobs} onDone={refreshDrums} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-sm sm:flex-row sm:items-center">
                  <Link href={`/lab-packs/${p.id}`} className="font-medium text-brand-blue">
                    Print
                  </Link>
                  <button type="button" onClick={() => setEditingId(p.id)} className="font-medium text-brand-blue">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDrum(p.id)}
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
