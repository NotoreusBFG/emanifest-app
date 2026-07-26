-- Tracks a user's progress through the guided EPA/RCRAInfo registration
-- wizard (see docs/epa-registration-wizard-design.md) -- one row per user.
-- Steps 1-3 are self-attested (a checkbox -- MM has no way to verify RCRAInfo
-- account creation, EPA ID approval, or ESA completion externally). Step 4/5
-- (API credentials) are the only steps MM actually confirms, by making a
-- real authenticated call with the entered credentials.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as every other
-- migration in this folder.

create table if not exists public.epa_registration_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cdx_account_done_at timestamptz,
  epa_id_requested_at timestamptz,
  epa_id_number text,
  esa_completed_at timestamptz,
  api_key_generated_at timestamptz,
  api_credentials_entered_at timestamptz,
  api_credentials_validated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.epa_registration_progress enable row level security;

drop policy if exists "Users can view their own onboarding progress" on public.epa_registration_progress;
create policy "Users can view their own onboarding progress"
  on public.epa_registration_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own onboarding progress" on public.epa_registration_progress;
create policy "Users can insert their own onboarding progress"
  on public.epa_registration_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own onboarding progress" on public.epa_registration_progress;
create policy "Users can update their own onboarding progress"
  on public.epa_registration_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
