import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadStatus =
  | "new"
  | "contacted"
  | "callback"
  | "interested"
  | "converted"
  | "not_interested"
  | "do_not_contact";

export type Lead = {
  id: string;
  source: string;
  epaHandlerId: string | null;
  companyName: string;
  generatorStatus: string | null;
  city: string | null;
  county: string | null;
  region: string | null;
  category: string | null;
  contactName: string | null;
  contactTitle: string | null;
  phone: string | null;
  email: string | null;
  eManifestExperience: string | null;
  manifestCount: number | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadActivity = {
  id: string;
  leadId: string;
  type: "call" | "email" | "visit" | "note" | "meeting";
  status: "open" | "closed";
  subject: string | null;
  notes: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type LeadFilters = {
  category?: string;
  county?: string;
  status?: string;
  eManifestExperience?: string;
};

function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    source: row.source as string,
    epaHandlerId: row.epa_handler_id as string | null,
    companyName: row.company_name as string,
    generatorStatus: row.generator_status as string | null,
    city: row.city as string | null,
    county: row.county as string | null,
    region: row.region as string | null,
    category: row.category as string | null,
    contactName: row.contact_name as string | null,
    contactTitle: row.contact_title as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    eManifestExperience: row.e_manifest_experience as string | null,
    manifestCount: row.manifest_count as number | null,
    status: row.status as LeadStatus,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapActivity(row: Record<string, unknown>): LeadActivity {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    type: row.type as LeadActivity["type"],
    status: row.status as LeadActivity["status"],
    subject: row.subject as string | null,
    notes: row.notes as string | null,
    scheduledAt: row.scheduled_at as string | null,
    completedAt: row.completed_at as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}

export async function listLeads(supabase: SupabaseClient, filters: LeadFilters = {}): Promise<Lead[]> {
  let query = supabase.from("leads").select("*").order("company_name");

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.county) query = query.eq("county", filters.county);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.eManifestExperience) query = query.eq("e_manifest_experience", filters.eManifestExperience);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list leads: ${error.message}`);
  return (data ?? []).map(mapLead);
}

export async function getLead(supabase: SupabaseClient, id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load lead ${id}: ${error.message}`);
  return data ? mapLead(data) : null;
}

export async function listDistinctCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("leads").select("category").not("category", "is", null);
  if (error) throw new Error(`Failed to list categories: ${error.message}`);
  return Array.from(new Set((data ?? []).map((row) => row.category as string))).sort();
}

export async function listDistinctCounties(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("leads").select("county").not("county", "is", null);
  if (error) throw new Error(`Failed to list counties: ${error.message}`);
  return Array.from(new Set((data ?? []).map((row) => row.county as string))).sort();
}

export async function updateLeadStatus(supabase: SupabaseClient, id: string, status: LeadStatus): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to update lead ${id}: ${error.message}`);
}

export async function listActivitiesForLead(supabase: SupabaseClient, leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list activities for lead ${leadId}: ${error.message}`);
  return (data ?? []).map(mapActivity);
}

export async function listLatestActivitiesForLeads(
  supabase: SupabaseClient,
  leadIds: string[]
): Promise<Map<string, LeadActivity>> {
  if (leadIds.length === 0) return new Map();

  const { data, error } = await supabase.from("lead_activities").select("*").in("lead_id", leadIds);
  if (error) throw new Error(`Failed to list latest activities: ${error.message}`);

  const latest = new Map<string, LeadActivity>();
  for (const row of data ?? []) {
    const activity = mapActivity(row);
    const effectiveDate = activity.completedAt ?? activity.createdAt;
    const current = latest.get(activity.leadId);
    const currentDate = current ? (current.completedAt ?? current.createdAt) : null;
    if (!current || effectiveDate > currentDate!) {
      latest.set(activity.leadId, activity);
    }
  }
  return latest;
}

export async function addLeadActivity(
  supabase: SupabaseClient,
  input: {
    leadId: string;
    type: LeadActivity["type"];
    subject?: string;
    notes?: string;
    scheduledAt?: string | null;
    completedAt?: string | null;
    createdBy?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: input.leadId,
    type: input.type,
    status: input.completedAt ? "closed" : "open",
    subject: input.subject || null,
    notes: input.notes || null,
    scheduled_at: input.scheduledAt || null,
    completed_at: input.completedAt || null,
    created_by: input.createdBy || null,
  });
  if (error) throw new Error(`Failed to log activity for lead ${input.leadId}: ${error.message}`);
}

export type LeadImportRow = {
  companyName: string;
  epaHandlerId?: string;
  generatorStatus?: string;
  city?: string;
  county?: string;
  region?: string;
  category?: string;
  contactName?: string;
  contactTitle?: string;
  phone?: string;
  email?: string;
  eManifestExperience?: string;
  manifestCount?: number;
  source?: string;
};

/**
 * Upsert on (source, epa_handler_id) so re-importing the same CSV (e.g.
 * after re-enriching a county) updates existing rows instead of duplicating
 * them. Rows without an epa_handler_id always insert as new.
 */
export async function bulkImportLeads(
  supabase: SupabaseClient,
  rows: LeadImportRow[]
): Promise<{ imported: number; skipped: number }> {
  const withId = rows.filter((r) => r.epaHandlerId);
  const withoutId = rows.filter((r) => !r.epaHandlerId);

  let imported = 0;
  const skipped = rows.length - withId.length - withoutId.length;

  if (withId.length > 0) {
    const { error, count } = await supabase
      .from("leads")
      .upsert(
        withId.map((r) => toInsertRow(r)),
        { onConflict: "source,epa_handler_id", count: "exact" }
      );
    if (error) throw new Error(`Bulk import failed: ${error.message}`);
    imported += count ?? withId.length;
  }

  if (withoutId.length > 0) {
    const { error, count } = await supabase
      .from("leads")
      .insert(
        withoutId.map((r) => toInsertRow(r)),
        { count: "exact" }
      );
    if (error) throw new Error(`Bulk import failed: ${error.message}`);
    imported += count ?? withoutId.length;
  }

  return { imported, skipped };
}

function toInsertRow(r: LeadImportRow) {
  return {
    source: r.source || "epa_frs",
    epa_handler_id: r.epaHandlerId || null,
    company_name: r.companyName,
    generator_status: r.generatorStatus || null,
    city: r.city || null,
    county: r.county || null,
    region: r.region || null,
    category: r.category || null,
    contact_name: r.contactName || null,
    contact_title: r.contactTitle || null,
    phone: r.phone || null,
    email: r.email || null,
    e_manifest_experience: r.eManifestExperience || null,
    manifest_count: r.manifestCount ?? null,
  };
}
