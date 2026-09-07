-- third_party_customers only stored third_party_user_id (a bare uuid) and
-- poc_email (the GENERATOR's contact, not the third party's own email) --
-- the generator-facing "connected third parties" list in Settings has no
-- way to know who to invite as a Quick-Sign delegate without this.
-- Denormalized at request-creation time, same reasoning as
-- quick_sign_delegates.owner_email.
alter table public.third_party_customers
  add column if not exists third_party_email text not null default '';
