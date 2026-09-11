"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteLabPackAction, listLabPacksForUserAction } from "@/app/actions/labPackActions";
import type { LabPack } from "@/lib/labPack/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SiteFilterButtons } from "@/components/SiteFilterButtons";
import { LabPackFormFields } from "@/components/LabPackFormFields";

function statusBadge(status: LabPack["status"]) {
  return status === "finalized"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

export default function LabPacksPage() {
  const [labPacks, setLabPacks] = useState<LabPack[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");

  const refresh = () => {
    listLabPacksForUserAction().then(setLabPacks);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = siteFilter ? labPacks?.filter((p) => p.generatorEpaId === siteFilter) ?? null : labPacks;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lab pack? This can't be undone.")) return;
    setDeletingId(id);
    await deleteLabPackAction(id);
    setDeletingId(null);
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Lab packs</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Build a packing list for a drum of small/mixed chemical containers, then link it to a
            manifest waste line when you&apos;re ready to ship. Codes flow through to the LDR notice
            automatically as a lab pack (40 CFR 268.42(c)).
          </p>
        </div>
        <Link href="/manifests/new" className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline">
          ← Create a manifest
        </Link>
      </div>

      <Card className="p-6">
        {!showCreate ? (
          <Button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm">
            + New lab pack
          </Button>
        ) : (
          <LabPackFormFields
            mode="create"
            onDone={() => {
              setShowCreate(false);
              refresh();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </Card>

      <div className="mt-6">
        <SiteFilterButtons value={siteFilter} onChange={setSiteFilter} />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {labPacks === null && <p className="text-sm text-gray-500">Loading…</p>}
        {labPacks && labPacks.length > 0 && filtered?.length === 0 && (
          <p className="text-sm text-gray-500">No lab packs for this site.</p>
        )}
        {labPacks?.length === 0 && <p className="text-sm text-gray-500">No lab packs yet.</p>}
        {filtered?.map((p) =>
          editingId === p.id ? (
            <Card key={p.id} className="p-6">
              <LabPackFormFields
                mode="edit"
                labPack={p}
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy">
                      Drum {p.drumNumber ?? "—"} {p.jobNumber && `· Job ${p.jobNumber}`}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {p.isNonHazardous ? "Non-hazardous" : p.dotShippingDescription || "No DOT description yet"}
                  </p>
                  {p.wasteCodes.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-500">Waste codes: {p.wasteCodes.join(", ")}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Generator: {p.generatorEpaId ? `${p.generatorName || "—"} (${p.generatorEpaId})` : "—"}
                  </p>
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
