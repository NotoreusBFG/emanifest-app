"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteLdrNoticeAttachmentAction,
  listLdrNoticeAttachmentsAction,
  uploadLdrNoticeAttachmentAction,
  type LdrAttachmentWithUrl,
} from "@/app/actions/ldrActions";
import { brand, brandGradient } from "@/lib/brandColors";

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Third-party PDFs kept on file alongside this notice (e.g. a lab's LDR
 * determination letter) — entirely separate from the notice ManifestMate
 * itself generates above. No-print (matches the rest of this page's
 * chrome), since these are reference documents, not part of the printable
 * notice itself.
 */
export function AttachmentsSection({ ldrNoticeId }: { ldrNoticeId: string }) {
  const [attachments, setAttachments] = useState<LdrAttachmentWithUrl[] | null>(null);
  const [uploadState, uploadFormAction, isUploading] = useActionState(uploadLdrNoticeAttachmentAction, null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => {
    listLdrNoticeAttachmentsAction(ldrNoticeId).then(setAttachments);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when the notice itself changes
  }, [ldrNoticeId]);

  useEffect(() => {
    if (uploadState?.success) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteLdrNoticeAttachmentAction(id);
    setDeletingId(null);
    refresh();
  };

  return (
    <div
      className="no-print"
      style={{ border: `1px solid ${brand.tint}`, borderRadius: "6px", padding: "20px", background: "white", marginTop: "16px" }}
    >
      <h3 style={{ color: brand.navy, marginTop: 0 }}>Supporting documents</h3>
      <p style={{ fontSize: "13px", color: "#666", marginTop: "-8px" }}>
        Upload a PDF from a third party (e.g. a lab&apos;s LDR determination letter) to keep on
        file with this notice. Up to 4MB per file.
      </p>

      {attachments === null ? (
        <p style={{ fontSize: "13px", color: "#888" }}>Loading…</p>
      ) : attachments.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#888" }}>No documents uploaded yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0 }}>
          {attachments.map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div style={{ minWidth: 0 }}>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: brand.blue, fontSize: "13px", fontWeight: 600 }}
                  >
                    {a.label || a.filename}
                  </a>
                ) : (
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{a.label || a.filename}</span>
                )}
                <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#999" }}>
                  {a.label ? `${a.filename} · ` : ""}
                  {formatFileSize(a.fileSizeBytes)} · {new Date(a.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                style={{
                  flexShrink: 0,
                  background: "none",
                  border: "none",
                  color: "#c0392b",
                  fontSize: "12px",
                  cursor: deletingId === a.id ? "not-allowed" : "pointer",
                }}
              >
                {deletingId === a.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        action={uploadFormAction}
        style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}
      >
        <input type="hidden" name="ldrNoticeId" value={ldrNoticeId} />
        <div style={{ flex: "1 1 160px" }}>
          <label style={{ display: "block", fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Label (optional)
          </label>
          <input
            name="label"
            type="text"
            placeholder="e.g. Acme Labs determination"
            style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "13px", width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#888", marginBottom: "4px" }}>PDF file</label>
          <input name="file" type="file" accept="application/pdf" required style={{ fontSize: "13px" }} />
        </div>
        <button
          type="submit"
          disabled={isUploading}
          style={{
            padding: "7px 14px",
            background: isUploading ? "#ccc" : brandGradient,
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isUploading ? "not-allowed" : "pointer",
          }}
        >
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </form>
      {uploadState?.success === false && (
        <p style={{ color: "#c0392b", fontSize: "12px", marginTop: "8px" }}>❌ {uploadState.error}</p>
      )}
    </div>
  );
}
