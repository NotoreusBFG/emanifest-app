-- Marketing/sales lead tracker (internal admin-only tool, not customer-facing).
-- Replaces the Google Sheets / local-CSV workflow used for the initial VA
-- generator lead scrubbing (see private-notes/marketing/ for the sourcing
-- methodology). One row per prospect company; `lead_activities` is a single
-- unified table for both a scheduled follow-up and a completed log entry
-- (pattern proven out in a separate CRM project — one row covers "call
-- scheduled" through "call happened, here's the outcome" instead of two
-- separate tables).

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'epa_frs',
  epa_handler_id text,
  company_name text not null,
  generator_status text,
  city text,
  county text,
  region text,
  category text,
  contact_name text,
  contact_title text,
  phone text,
  email text,
  e_manifest_experience text,
  manifest_count integer,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_status_check check (
    status in ('new', 'contacted', 'callback', 'interested', 'converted', 'not_interested', 'do_not_contact')
  ),
  constraint leads_source_handler_unique unique (source, epa_handler_id)
);

create index if not exists leads_category_idx on leads (category);
create index if not exists leads_county_idx on leads (county);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_e_manifest_experience_idx on leads (e_manifest_experience);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  type text not null,
  status text not null default 'open',
  subject text,
  notes text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint lead_activities_type_check check (type in ('call', 'email', 'visit', 'note')),
  constraint lead_activities_status_check check (status in ('open', 'closed'))
);

create index if not exists lead_activities_lead_id_idx on lead_activities (lead_id);
create index if not exists lead_activities_status_idx on lead_activities (status);

alter table leads enable row level security;
alter table lead_activities enable row level security;

-- Admin-only, both tables. See 20260901_fix_leads_rls_admin_check.sql —
-- the first version of this policy used current_setting('app.admin_email'),
-- which turned out to require database-superuser privileges Supabase's
-- hosted Postgres doesn't grant; that migration replaces these two
-- policies with an admin_users table + SECURITY DEFINER function instead.
create policy "leads_admin_all" on leads
  for all
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true))
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "lead_activities_admin_all" on lead_activities
  for all
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true))
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
