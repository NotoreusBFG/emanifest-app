import type { SupabaseClient } from "@supabase/supabase-js";
import { describePostgrestError } from "@/services/manifestRepository";

export interface WasteProfileDocument {
  id: string;
  wasteProfileId: string;
  filename: string;
  storagePath: string;
  fileSizeBytes: number | null;
  uploadedAt: string;
}

const DOCUMENT_SELECT_COLUMNS = "id, waste_profile_id, filename, storage_path, file_size_bytes, uploaded_at";

function documentFromRow(row: {
  id: string;
  waste_profile_id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  uploaded_at: string;
}): WasteProfileDocument {
  return {
    id: row.id,
    wasteProfileId: row.waste_profile_id,
    filename: row.filename,
    storagePath: row.storage_path,
    fileSizeBytes: row.file_size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

/**
 * Stores the source PDF a ManifestMate Wizard profile was drafted from, so
 * it stays attached and viewable/downloadable from the profile's own page
 * -- an audit trail back to the actual document, not just the extracted
 * values. Mirrors src/services/ldrRepository.ts's
 * uploadLdrNoticeAttachment field-for-field. Path convention:
 * {user_id}/{waste_profile_id}/{filename}, matching the storage.objects
 * RLS policies in 20260921_create_waste_profile_documents.sql.
 */
export async function uploadWasteProfileDocument(
  supabase: SupabaseClient,
  userId: string,
  wasteProfileId: string,
  file: { name: string; bytes: Uint8Array }
): Promise<{ success: true; document: WasteProfileDocument } | { success: false; error: string }> {
  const storagePath = `${userId}/${wasteProfileId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("waste-profile-documents")
    .upload(storagePath, file.bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { success: false, error: uploadError.message };

  const { data, error } = await supabase
    .from("waste_profile_documents")
    .insert({
      waste_profile_id: wasteProfileId,
      user_id: userId,
      filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.bytes.length,
    })
    .select(DOCUMENT_SELECT_COLUMNS)
    .single();

  if (error) return { success: false, error: describePostgrestError(error) };
  return { success: true, document: documentFromRow(data) };
}

export async function listWasteProfileDocuments(
  supabase: SupabaseClient,
  wasteProfileId: string
): Promise<WasteProfileDocument[]> {
  const { data, error } = await supabase
    .from("waste_profile_documents")
    .select(DOCUMENT_SELECT_COLUMNS)
    .eq("waste_profile_id", wasteProfileId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("listWasteProfileDocuments failed:", describePostgrestError(error));
    return [];
  }
  return data.map(documentFromRow);
}

/**
 * All of a user's waste-profile documents in one query, keyed by
 * waste_profile_id -- lets the dashboard list show a "view source
 * document" link per card without an N+1 query per profile.
 */
export async function listWasteProfileDocumentsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, WasteProfileDocument>> {
  const { data, error } = await supabase
    .from("waste_profile_documents")
    .select(DOCUMENT_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("listWasteProfileDocumentsForUser failed:", describePostgrestError(error));
    return new Map();
  }
  const byProfileId = new Map<string, WasteProfileDocument>();
  for (const row of data) {
    // Most recent per profile wins if a profile somehow has more than one
    // -- ordered descending above, so the first one seen per id is kept.
    if (!byProfileId.has(row.waste_profile_id)) {
      byProfileId.set(row.waste_profile_id, documentFromRow(row));
    }
  }
  return byProfileId;
}

/** Short-lived signed URL -- the bucket is private, so documents aren't reachable without one. */
export async function getWasteProfileDocumentDownloadUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("waste-profile-documents").createSignedUrl(storagePath, 600);
  if (error) {
    console.error("getWasteProfileDocumentDownloadUrl failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
