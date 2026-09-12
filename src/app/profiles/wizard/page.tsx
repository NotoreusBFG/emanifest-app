"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LockedGeneratorSelect } from "@/components/LockedGeneratorSelect";
import { WasteProfileFormFields } from "@/components/WasteProfileFormFields";
import { extractWasteProfileDocumentAction, saveWizardWasteProfileAction } from "@/app/actions/wizardActions";
import { toFormFieldsProps, type WizardExtractedProfile } from "@/lib/ai/wizardExtraction";
import type { SiteSearchResultItem } from "@/lib/rcrainfo/types";

type FileStatus = "pending" | "reading" | "done" | "error";
interface QueuedFile {
  file: File;
  status: FileStatus;
  extracted?: WizardExtractedProfile;
  error?: string;
}

type Step = "upload" | "reading" | "review";

export default function ManifestMateWizardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatorEpaId, setGeneratorEpaId] = useState("");
  const [generatorName, setGeneratorName] = useState("");
  const [generatorAddress, setGeneratorAddress] = useState("");

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [reviewIndex, setReviewIndex] = useState(0);

  const fillGeneratorFromSite = (site: SiteSearchResultItem) => {
    const addr = site.siteAddress;
    setGeneratorEpaId(site.epaSiteId);
    setGeneratorName(site.name);
    setGeneratorAddress([addr?.address1, addr?.city, addr?.state?.code, addr?.zip].filter(Boolean).join(", "));
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setQueue(Array.from(files).map((file) => ({ file, status: "pending" as const })));
  };

  const startReading = async () => {
    setStep("reading");
    // Sequential, not parallel -- keeps behavior predictable and per-document
    // cost/latency bounded, and matches "no bulk auto-save" (everything is
    // still one document, one decision at a time downstream in review).
    for (let i = 0; i < queue.length; i++) {
      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: "reading" } : item)));
      const formData = new FormData();
      formData.set("file", queue[i].file);
      const result = await extractWasteProfileDocumentAction(formData);
      setQueue((q) =>
        q.map((item, idx) =>
          idx === i
            ? result.success
              ? { ...item, status: "done", extracted: result.extracted }
              : { ...item, status: "error", error: result.error }
            : item
        )
      );
    }
    setStep("review");
  };

  const reviewable = queue.filter((q) => q.status === "done");
  const currentReview = reviewable[reviewIndex];

  const advanceReview = () => {
    if (reviewIndex + 1 < reviewable.length) {
      setReviewIndex((i) => i + 1);
    } else {
      router.push("/profiles");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/profiles" className="text-sm font-medium text-brand-blue hover:underline">
        ← Back to Waste profiles
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <Image src="/manifestmate-wizard-icon.png" alt="" width={40} height={40} />
        <h1 className="text-2xl font-bold text-brand-navy">ManifestMate Wizard</h1>
      </div>

      {step === "upload" && (
        <Card className="mt-6 p-6">
          <p className="text-sm text-gray-600">
            Upload one or more of your facility&apos;s approved waste profile documents and the
            Wizard drafts a <strong className="text-brand-navy">ManifestMate profile</strong> for
            each one. You still review and save every profile — same as adding one by hand.
          </p>
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-600">
            A ManifestMate profile is for use within the ManifestMate system only — it is not
            documentation of waste approval by any disposal facility. The Wizard loads a document
            your facility has already approved; it doesn&apos;t characterize or approve anything new.
          </div>

          <div className="mt-5">
            <p className="mb-1 text-sm font-medium text-brand-navy">Generator</p>
            {!generatorEpaId ? (
              <LockedGeneratorSelect onSelect={fillGeneratorFromSite} source="managed" />
            ) : (
              <div className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand-navy">
                <span className="font-semibold">Generator:</span> {generatorName} ({generatorEpaId})
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Set this first — every profile the Wizard drafts belongs to one site, same as the
              manual form.
            </p>
          </div>

          {generatorEpaId && (
            <div className="mt-5">
              <div
                className="rounded-md border-2 border-dashed border-gray-300 p-8 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
              >
                <p className="text-sm font-semibold text-brand-navy">
                  Drag one or more PDFs here, or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Approved waste profile documents only · PDF · up to 4MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-2 text-sm"
                >
                  Choose files
                </Button>
              </div>

              {queue.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-brand-navy">{queue.length} file(s) selected</p>
                  <ul className="mt-1 divide-y divide-gray-100 text-sm text-gray-700">
                    {queue.map((q, i) => (
                      <li key={i} className="flex items-center justify-between py-1.5">
                        <span>📄 {q.file.name}</span>
                        <span className="text-xs text-gray-400">{(q.file.size / 1024).toFixed(0)} KB</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-gray-500">
                    Each document becomes its own profile with its own MM-# number — nothing is
                    merged. You&apos;ll review and save them one at a time next.
                  </p>
                  <Button onClick={startReading} className="mt-3 px-4 py-2 text-sm">
                    Read {queue.length} document{queue.length === 1 ? "" : "s"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {step === "reading" && (
        <Card className="mt-6 p-6">
          <h2 className="text-lg font-bold text-brand-navy">Reading your documents</h2>
          <p className="mt-1 text-sm text-gray-600">
            This takes a few seconds per document — the Wizard doesn&apos;t save anything until
            you&apos;ve reviewed each draft.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {queue.map((q, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-brand-navy px-4 py-2 text-sm text-white">
                <span>{q.file.name}</span>
                <span className="text-xs font-semibold">
                  {q.status === "pending" && "Waiting…"}
                  {q.status === "reading" && "Reading…"}
                  {q.status === "done" && "✓ Ready for review"}
                  {q.status === "error" && `✕ ${q.error ?? "Failed"}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === "review" && (
        <>
          {reviewable.length === 0 && (
            <Card className="mt-6 p-6">
              <p className="text-sm text-gray-600">
                None of the uploaded documents could be read. Check the errors above, or{" "}
                <Link href="/profiles" className="text-brand-blue hover:underline">
                  go back to Waste profiles
                </Link>{" "}
                to add one manually.
              </p>
            </Card>
          )}
          {currentReview?.extracted && (
            <Card className="mt-6 p-6">
              {(() => {
                const { initialValues, wizardFlags } = toFormFieldsProps(currentReview.extracted);
                return (
                  <WasteProfileFormFields
                    mode="wizard"
                    initialValues={initialValues}
                    wizardFlags={wizardFlags}
                    fixedGenerator={{ epaId: generatorEpaId, name: generatorName, address: generatorAddress }}
                    queuePosition={{ current: reviewIndex + 1, total: reviewable.length }}
                    sourceDocumentName={currentReview.file.name}
                    fileToAttach={currentReview.file}
                    onWizardSubmit={saveWizardWasteProfileAction}
                    onDone={advanceReview}
                    onCancel={advanceReview}
                  />
                );
              })()}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
