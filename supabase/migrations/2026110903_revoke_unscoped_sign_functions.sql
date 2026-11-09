-- Security fix, step 2 (ManifestMate security review, Matt 2026-11-09). Apply ONLY after the code that calls the
-- token-scoped replacements (get_transporter_credentials_for_token, set_manifest_*_signed_at_for_token) is live, or the
-- driver and generator sign pages break.
--
-- The old functions took a bare transporter id or user id + manifest number and trusted it. Nothing calls them any more,
-- so no role may execute them (kept, not dropped, so a rollback of the code is a one-line grant).

revoke execute on function public.get_transporter_credentials(uuid) from public, anon, authenticated;
revoke execute on function public.update_manifest_generator_signed_at(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.update_manifest_transporter_signed_at(uuid, text, timestamptz) from public, anon, authenticated;
