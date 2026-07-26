-- Adds a denormalized transporter-name(s) column to the manifests mirror,
-- for the dashboard's "Transporter" column (previously only Generator and
-- Designated facility names were stored -- transporters were only reflected
-- via transporter_signed_at, with no name to display). Comma-joined since a
-- manifest can have more than one transporter.
--
-- Run this in the Supabase Dashboard -> SQL Editor, same as the other
-- migrations in this folder.

alter table if exists public.manifests
  add column if not exists transporter_names text;
