"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  deleteWasteProfileAction,
  listWasteProfilesForUserAction,
} from "@/app/actions/wasteProfileActions";
import { isWizardEnabledForMeAction, listMyWasteProfileDocumentUrlsAction } from "@/app/actions/wizardActions";
import type { WasteProfile } from "@/services/wasteProfileRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PrintLabelForm } from "./PrintLabelForm";
import { SiteFilterButtons } from "@/components/SiteFilterButtons";
import { WasteProfileFormFields } from "@/components/WasteProfileFormFields";
import { WASTE_CATEGORY_OPTIONS, WASTE_CATEGORY_BORDER } from "./wasteCategoryOptions";

export default function WasteProfilesPage() {
  const [profiles, setProfiles] = useState<WasteProfile[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");
  const [wizardEnabled, setWizardEnabled] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, { filename: string; url: string }>>({});

  const refresh = () => {
    listWasteProfilesForUserAction().then(setProfiles);
    // Re-fetched alongside the profile list rather than cached -- these are
    // short-lived signed URLs (10 min), same lifetime as the LDR attachment
    // pattern this mirrors.
    listMyWasteProfileDocumentUrlsAction().then(setDocumentUrls);
  };

  const filteredProfiles = siteFilter
    ? profiles?.filter((p) => p.generatorEpaId === siteFilter) ?? null
    : profiles;

  useEffect(() => {
    refresh();
    isWizardEnabledForMeAction().then(setWizardEnabled);
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
        <div className="flex flex-col items-end gap-1">
          <Link href="/manifests/new" className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline">
            ← Create a manifest
          </Link>
          <Link href="/labels/generator" className="whitespace-nowrap text-sm font-medium text-brand-blue hover:underline">
            Print labels for a generator →
          </Link>
        </div>
      </div>

      <Card className="p-6">
        {!showCreate ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setShowCreate(true)} className="px-4 py-2 text-sm">
              + Add waste profile
            </Button>
            {wizardEnabled && (
              <Link
                href="/profiles/wizard"
                className="inline-flex items-center gap-2 rounded-md border-2 border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-tint"
              >
                <Image src="/manifestmate-wizard-icon.png" alt="" width={30} height={30} />
                ManifestMate Wizard
              </Link>
            )}
          </div>
        ) : (
          <WasteProfileFormFields
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
        {profiles === null && <p className="text-sm text-gray-500">Loading…</p>}
        {profiles && profiles.length > 0 && filteredProfiles?.length === 0 && (
          <p className="text-sm text-gray-500">No saved waste profiles for this site.</p>
        )}
        {profiles?.length === 0 && <p className="text-sm text-gray-500">No saved waste profiles yet.</p>}
        {filteredProfiles?.map((p) =>
          editingId === p.id ? (
            <Card key={p.id} className="p-6">
              <WasteProfileFormFields
                mode="edit"
                profile={p}
                onDone={() => {
                  setEditingId(null);
                  refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            </Card>
          ) : printingId === p.id ? (
            <Card key={p.id} className="p-6">
              <PrintLabelForm profile={p} onCancel={() => setPrintingId(null)} />
            </Card>
          ) : (
            <Card key={p.id} className={`p-4 ${WASTE_CATEGORY_BORDER[p.wasteCategory]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">
                    {p.profileName} <span className="font-normal text-gray-400">— {p.mmProfileNumber}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">
                    {WASTE_CATEGORY_OPTIONS.find((o) => o.value === p.wasteCategory)?.label ?? p.wasteCategory}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {p.dotHazardous ? p.properShippingName : p.wasteDescription}
                    {p.hazardClass && ` · Class ${p.hazardClass}`}
                    {p.idNumberCode && ` · ${p.idNumberCode}`}
                    {p.federalWasteCode && ` · ${p.federalWasteCode}`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Generator: {p.generatorEpaId ? `${p.generatorName || "—"} (${p.generatorEpaId})` : "not set (legacy profile)"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Disposal facility: {p.disposalFacilityName || "—"} ({p.disposalFacilityEpaId})
                    {p.disposalFacilityProfileNumber && ` · Facility profile # ${p.disposalFacilityProfileNumber}`}
                  </p>
                  {documentUrls[p.id] && (
                    <a
                      href={documentUrls[p.id].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand-blue hover:underline"
                    >
                      📎 {documentUrls[p.id].filename}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button type="button" onClick={() => setPrintingId(p.id)} className="font-medium text-brand-blue">
                    Print label
                  </button>
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
