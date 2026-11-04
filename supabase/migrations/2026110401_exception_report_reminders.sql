-- Exception Report email reminders (day 45 "find the signed copy", day 60
-- "Exception Report due"). One row per manifest per stage so the daily cron
-- never re-sends. Written only by the cron route with the service-role key;
-- RLS is enabled with no policies, so the anon/authenticated roles cannot
-- read or write it. exception_report_email_optout lets a user turn the
-- reminders off (honored by the cron; a settings toggle is a follow-up).

create table if not exists public.exception_report_reminders (
  epa_mtn text not null,
  stage text not null check (stage in ('search', 'file')),
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (epa_mtn, stage)
);
alter table public.exception_report_reminders enable row level security;

create table if not exists public.exception_report_email_optout (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.exception_report_email_optout enable row level security;

drop policy if exists "Users can view their own opt-out" on public.exception_report_email_optout;
create policy "Users can view their own opt-out"
  on public.exception_report_email_optout for select using (auth.uid() = user_id);
drop policy if exists "Users can opt themselves out" on public.exception_report_email_optout;
create policy "Users can opt themselves out"
  on public.exception_report_email_optout for insert with check (auth.uid() = user_id);
drop policy if exists "Users can opt themselves back in" on public.exception_report_email_optout;
create policy "Users can opt themselves back in"
  on public.exception_report_email_optout for delete using (auth.uid() = user_id);
