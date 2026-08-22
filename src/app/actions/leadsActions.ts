"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { splitCsvLine } from "@/lib/csv";
import {
  addLeadActivity,
  bulkImportLeads,
  bulkSetLeadsRemoved,
  updateLeadStatus,
  type LeadImportRow,
  type LeadStatus,
} from "@/services/leadsRepository";

export async function bulkRemoveLeadsAction(ids: string[]) {
  const { supabase } = await requireAdmin();
  await bulkSetLeadsRemoved(supabase, ids, true);
  revalidatePath("/admin/leads");
}

export async function bulkRestoreLeadsAction(ids: string[]) {
  const { supabase } = await requireAdmin();
  await bulkSetLeadsRemoved(supabase, ids, false);
  revalidatePath("/admin/leads");
}

export async function updateLeadStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id) throw new Error("Missing lead id");
  if (typeof status !== "string" || !status) throw new Error("Missing status");

  await updateLeadStatus(supabase, id, status as LeadStatus);
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
}

export async function addLeadActivityAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const leadId = formData.get("leadId");
  const type = formData.get("type");
  const subject = formData.get("subject");
  const notes = formData.get("notes");
  const scheduledAt = formData.get("scheduledAt");
  const markCompleted = formData.get("markCompleted") === "true";

  if (typeof leadId !== "string" || !leadId) throw new Error("Missing lead id");
  if (typeof type !== "string" || !["call", "email", "visit", "note", "meeting"].includes(type)) {
    throw new Error("Invalid activity type");
  }

  await addLeadActivity(supabase, {
    leadId,
    type: type as "call" | "email" | "visit" | "note" | "meeting",
    subject: typeof subject === "string" ? subject : undefined,
    notes: typeof notes === "string" ? notes : undefined,
    scheduledAt: typeof scheduledAt === "string" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    completedAt: markCompleted ? new Date().toISOString() : null,
    createdBy: user?.id ?? null,
  });

  revalidatePath(`/admin/leads/${leadId}`);
}

const IMPORT_COLUMNS: Record<string, keyof LeadImportRow> = {
  "company name": "companyName",
  "epa handler id": "epaHandlerId",
  "generator status": "generatorStatus",
  city: "city",
  county: "county",
  region: "region",
  category: "category",
  "contact name": "contactName",
  "contact title": "contactTitle",
  phone: "phone",
  email: "email",
  "e-manifest experience": "eManifestExperience",
  "manifests since 2023": "manifestCount",
  "manifest count": "manifestCount",
};

/**
 * Accepts the exact CSV shape produced by the va-generator-data-mapping
 * skill's classification scripts (private-notes/marketing/) — pasted as
 * text rather than uploaded as a file, since this is a one-off internal
 * import step, not a repeated user-facing flow.
 */
function parseLeadsCsv(text: string): { rows: LeadImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ["Paste a header row plus at least one data row."] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const columnMap = headers.map((h) => IMPORT_COLUMNS[h]);
  if (!columnMap.includes("companyName")) {
    return { rows: [], errors: ['Missing required column "Company Name".'] };
  }

  const errors: string[] = [];
  const rows: LeadImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Partial<LeadImportRow> = {};
    columnMap.forEach((key, idx) => {
      if (!key) return;
      const raw = values[idx]?.trim();
      if (!raw) return;
      if (key === "manifestCount") {
        const n = Number(raw.replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(n)) row.manifestCount = n;
      } else if (key === "eManifestExperience") {
        row.eManifestExperience = raw.toUpperCase().startsWith("EXPERIENCED") ? "experienced" : "novice";
      } else {
        (row as Record<string, string>)[key] = raw;
      }
    });

    if (!row.companyName) {
      errors.push(`Row ${i + 1}: missing company name, skipped.`);
      continue;
    }
    rows.push(row as LeadImportRow);
  }

  return { rows, errors };
}

export async function importLeadsAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const csvText = formData.get("csv");
  if (typeof csvText !== "string" || !csvText.trim()) {
    throw new Error("Paste CSV data first.");
  }
  const { rows } = parseLeadsCsv(csvText);
  if (rows.length === 0) {
    throw new Error("No importable rows found.");
  }
  const { imported, skipped } = await bulkImportLeads(supabase, rows);
  revalidatePath("/admin/leads");
  redirect(`/admin/leads?imported=${imported}&skipped=${skipped}`);
}
