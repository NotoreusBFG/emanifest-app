"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { success: false, error: error.message };
  redirect(safeNextPath(formData.get("next"), "/settings"));
}

export async function signUpAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = formData.get("next");

  // Supabase's own confirmation email is the thing that actually lands the
  // new user back on the site (no active session exists until they click
  // it) -- emailRedirectTo is what controls where that click sends them.
  // Requires this app's URL to be allow-listed under Supabase's Auth ->
  // URL Configuration -> Redirect URLs, same as any other custom
  // emailRedirectTo; if it's not listed there, Supabase falls back to the
  // project's default Site URL instead of `next`.
  const headersList = await headers();
  const origin = headersList.get("origin") ?? `https://${headersList.get("host")}`;
  const emailRedirectTo = `${origin}${safeNextPath(next, "/settings")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) return { success: false, error: error.message };
  return { success: true, message: "Check your email to confirm your account, then sign in." };
}

export async function signOutAction(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNextPath(formData?.get("next") ?? null, "/login"));
}
