# Deployment & Email Setup (manual, one-time)

Not started yet as of 2026-07-26 — the app only runs via `npm run dev` locally,
and Supabase Auth is still on its default (rate-limited, unbranded) mailer.
None of this blocks continued dev/testing; it's needed **before the first
real (non-test) customer signs up.**

Domain `getmanifestmate.com` is already registered at Wix — Wix only needs to
handle DNS here, not hosting (it can't run this app; see below).

## 1. Host the app on Vercel

Wix is a page-builder, not a Node host — this app needs server actions,
middleware, and server-side Supabase auth, none of which Wix supports.
Vercel is Next.js's own platform and is the path of least resistance.

1. Push this repo to GitHub if it isn't already (check `git remote -v`).
2. Create a Vercel account, "Add New Project," import the GitHub repo.
3. Set environment variables in Vercel (Project Settings → Environment
   Variables) — same keys as `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ENCRYPTION_SECRET_KEY`
   - `RCRAINFO_ENV` (switch to the production RCRAInfo value when ready — currently preprod)
   - `RCRAINFO_API_ID` / `RCRAINFO_API_KEY`
4. Deploy. Vercel gives you a `*.vercel.app` URL immediately — confirm the
   app actually works there before wiring the custom domain.
5. In Vercel: Project Settings → Domains → add `getmanifestmate.com` (and
   `www.getmanifestmate.com`). Vercel shows the exact DNS records needed.
6. In Wix's DNS management for the domain: add those records (typically an
   `A` record for the apex domain and a `CNAME` for `www`). Remove/replace
   any Wix-site DNS records that would conflict — Wix's site itself won't be
   serving this domain anymore.
7. Wait for DNS propagation, confirm `https://getmanifestmate.com` loads the
   real app with a valid cert (Vercel auto-provisions TLS).

## 2. Transactional email via Resend

This covers Supabase Auth's automated emails only (confirm-signup,
password reset, and eventually real delegate-invite emails instead of the
current copy-link workaround). Do **not** point this at Gmail/Workspace —
see the note at the bottom.

1. Create a Resend account, add `getmanifestmate.com` as a sending domain.
2. Resend gives you SPF/DKIM DNS records to add — add them at Wix's DNS
   panel alongside the Vercel records above.
3. Once verified, generate an SMTP credential (or API key) from Resend.
4. In the Supabase Dashboard: Authentication → Email Templates → SMTP
   Settings — enable "Custom SMTP" and enter Resend's SMTP host/port/
   credentials. Sender address should be something like
   `noreply@getmanifestmate.com` (doesn't need to be a real receivable
   inbox — see part 3).
5. While there, paste in `supabase/email-templates/confirm-signup.html`
   (already built, currently unused) as the actual Confirm Signup template.
   It references `{{ .SiteURL }}` for the logo, so also set
   Authentication → URL Configuration → Site URL to
   `https://getmanifestmate.com` at the same time — this also fixes
   redirect URLs for the delegate-invite-accept flow, which currently only
   round-trips correctly against `localhost`.
6. Test: sign up a throwaway account against production and confirm the
   branded email arrives and the confirmation link lands back on the real
   domain, not localhost.

## 3. Human email (you@getmanifestmate.com)

Pick one — this is independent of Resend and doesn't block anything above.

**Free option (fine for a one-person operation):**
1. Cloudflare Email Routing or ImprovMX (free) — forwards
   `matt@getmanifestmate.com` to your existing personal Gmail address.
2. In Gmail: Settings → Accounts → "Send mail as" → add
   `matt@getmanifestmate.com`, verify via the forwarded confirmation code.
3. Done — one Gmail inbox, sends and receives as the domain address, no
   ongoing cost.

**Paid option (Google Workspace, ~$6-7/user/month):**
Same end result, plus Calendar/Drive/shared-workspace features and cleaner
SPF/DKIM-aligned sending out of the box. Worth it if you add a second person
or want it to feel more "official" — not required to launch solo.

**Why not use Resend for this too:** Resend is send-only — no inbox, no
webmail, no way to receive or reply to mail as a human. It can't replace
either option above; it only ever covers part 2, never part 3.

## Suggested order

Part 1 (Vercel) unblocks everything else and should happen first. Parts 2
and 3 can happen in either order after that, but part 2 should be done
before onboarding any real customer, since it's what makes signup/invite
emails actually deliverable and correctly branded.
