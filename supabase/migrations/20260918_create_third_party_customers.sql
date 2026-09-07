-- Third-party (broker/consultant) customer list: which generators a
-- third_party account is allowed to act for -- gated by the generator's
-- own POC approving a connection request via a public, no-login email
-- link (same anonymous-SECURITY-DEFINER-RPC trust model as
-- generator_sign_tokens, since the POC never needs a ManifestMate
-- account). Approval grants creation-only access (see LockedGeneratorSelect's
-- third_party source in a later change) -- signing on the generator's
-- behalf is a separate, generator-initiated step via the existing
-- Quick-Sign delegation feature, not anything granted here.

create table if not exists public.third_party_customers (
  id uuid primary key default gen_random_uuid(),
  third_party_user_id uuid not null references auth.users(id) on delete cascade,
  epa_site_id text not null,
  site_name text not null default '',
  site_address text not null default '',
  poc_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'revoked')),
  approval_token uuid not null unique default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,

  constraint third_party_customers_epa_id_not_blank check (epa_site_id <> ''),
  constraint third_party_customers_poc_email_length check (char_length(poc_email) < 320)
);

create unique index if not exists third_party_customers_one_active_per_pair
  on public.third_party_customers(third_party_user_id, epa_site_id)
  where status in ('pending', 'approved');

create index if not exists third_party_customers_third_party_idx
  on public.third_party_customers(third_party_user_id);

alter table public.third_party_customers enable row level security;

-- Third party manages their own requests directly -- real authenticated
-- owner on this side, unlike generator_sign_tokens' fully anonymous model.
create policy "Third parties can view their own requests" on public.third_party_customers
  for select using (auth.uid() = third_party_user_id);

create policy "Third parties can create requests" on public.third_party_customers
  for insert with check (auth.uid() = third_party_user_id and status = 'pending');

create policy "Third parties can revoke their own requests" on public.third_party_customers
  for update using (auth.uid() = third_party_user_id)
  with check (auth.uid() = third_party_user_id and status = 'revoked');

-- Generator-facing: lets a generator see who has approved access to their
-- own declared sites (for the "connected third parties" list + Quick-Sign
-- invite nudge in Settings) -- matched by their own generator_managed_sites
-- rows, not by any direct link to third_party_customers.
create policy "Generators can view approved connections for their sites" on public.third_party_customers
  for select using (
    status = 'approved'
    and exists (
      select 1 from public.generator_managed_sites g
      where g.user_id = auth.uid() and g.epa_site_id = third_party_customers.epa_site_id
    )
  );

-- Deliberately no client-facing policy lets anyone set status to
-- 'approved'/'declined' -- that only ever happens through the anonymous
-- SECURITY DEFINER RPCs below, since the POC approving has no ManifestMate
-- account at all (same reasoning as generator_sign_tokens' deny-all).

-- Anonymous-facing read: display data for the public
-- /third-party/approve page, and also used by the app after a successful
-- approve to pull the site info needed to claim it into
-- generator_managed_sites (see claimManagedSiteFromConnectionAction).
create or replace function public.get_customer_connection_request(p_token uuid)
returns table (site_name text, epa_site_id text, site_address text, third_party_email text, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select c.site_name, c.epa_site_id, c.site_address, u.email::text, c.status, c.expires_at
    from public.third_party_customers c
    join auth.users u on u.id = c.third_party_user_id
    where c.approval_token = p_token;
end;
$$;

revoke all on function public.get_customer_connection_request(uuid) from public;
grant execute on function public.get_customer_connection_request(uuid) to anon, authenticated;

-- Anonymous-facing: the only path to approved/declined. Link-possession
-- alone is sufficient (matches generator_sign_tokens' precedent of
-- link-possession already triggering a real EPA e-signature -- a
-- materially higher-stakes action than approving a data-visibility
-- relationship).
create or replace function public.respond_to_customer_connection(p_token uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.third_party_customers
  set status = case when p_approve then 'approved' else 'declined' end,
      responded_at = now()
  where approval_token = p_token
    and status = 'pending'
    and expires_at > now();
end;
$$;

revoke all on function public.respond_to_customer_connection(uuid, boolean) from public;
grant execute on function public.respond_to_customer_connection(uuid, boolean) to anon, authenticated;
