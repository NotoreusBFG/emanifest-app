"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAccountType } from "@/services/profileRepository";
import { getAdminEmails } from "@/lib/admin";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email/resendClient";

/** Only ever follows a same-origin relative path (must start with a single
 * "/", never "//" which browsers treat as protocol-relative to another
 * host) — a `next` value comes from a URL query string, so treating it as
 * trustworthy without this check would be an open-redirect hole. */
function safeNextPath(next: FormDataEntryValue | null, fallback: string): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

export async function signInAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { success: false, error: error.message };

  const accountType = data.user ? await getAccountType(supabase, data.user.id) : "generator";
  const fallback = accountType === "transporter" ? "/transporter-dashboard" : "/dashboard";
  redirect(safeNextPath(formData.get("next"), fallback));
}

export async function signUpAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next");

  // Only ever 'generator' or 'transporter' -- never trust the raw form
  // value beyond that allowlist (same defensive pattern as safeNextPath).
  const rawAccountType = formData.get("account_type");
  const accountType = rawAccountType === "transporter" ? "transporter" : "generator";

  // Supabase's own confirmation email is the thing that actually lands the
  // new user back on the site (no active session exists until they click
  // it) -- emailRedirectTo is what controls where that click sends them.
  // Requires this app's URL to be allow-listed under Supabase's Auth ->
  // URL Configuration -> Redirect URLs, same as any other custom
  // emailRedirectTo; if it's not listed there, Supabase falls back to the
  // project's default Site URL instead of `next`.
  const headersList = await headers();
  const origin = headersList.get("origin") ?? `https://${headersList.get("host")}`;
  const fallback = accountType === "transporter" ? "/transporter-dashboard" : "/dashboard";
  const emailRedirectTo = `${origin}${safeNextPath(next, fallback)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { account_type: accountType } },
  });

  if (error) return { success: false, error: error.message };

  // Generator signups now require manual approval before they get app
  // access (see 2026090601_add_approval_gate_to_profiles.sql) -- notify
  // every admin so there's no need to remember to check /admin. Non-fatal:
  // the account still gets created (and the profiles row still lands
  // pending) even if this email fails to send.
  if (accountType === "generator") {
    const adminUrl = `${origin}/admin`;
    for (const adminEmail of getAdminEmails()) {
      try {
        await sendEmail(
          adminEmail,
          "New ManifestMate signup awaiting approval",
          `${email} just signed up for a generator account. Approve them here: ${adminUrl}`
        );
      } catch (err) {
        if (!(err instanceof EmailNotConfiguredError)) {
          console.error("Admin signup-notification email failed (non-fatal):", err);
        }
      }
    }
  }

  return { success: true, message: "Check your email to confirm your account, then sign in." };
}

export async function changePasswordAction(prevState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) return { success: false, error: "Passwords do not match." };
  if (password.length < 6) return { success: false, error: "Password must be at least 6 characters." };

  // updateUser() operates on the caller's own session -- there's no
  // separate userId param, so this can only ever change the signed-in
  // user's own password (no cross-account risk to guard against here).
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { success: false, error: error.message };
  return { success: true, message: "Password updated." };
}

export async function signOutAction(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNextPath(formData?.get("next") ?? null, "/login"));
}
