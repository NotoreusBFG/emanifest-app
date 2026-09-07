import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getProfileGate } from "@/services/profileRepository";

/**
 * Refreshes the Supabase session cookie on every request (required by
 * @supabase/ssr — without this, sessions expire silently mid-use) and
 * redirects unauthenticated users away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = [
    "/settings",
    "/manifests",
    "/dashboard",
    "/onboarding",
    "/ldr",
    "/bol",
    "/transporters",
    "/transporter-dashboard",
  ];
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && isProtected) {
    // Preserves the original destination (path + query, e.g. a shared
    // "?mtn=..." sign link) as `next`, so /login can send them back where
    // they meant to go instead of dropping them at a bare login screen —
    // same `next` convention the delegate-invite flow uses (see
    // authActions.ts's safeNextPath).
    const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(originalPath)}`;
    return NextResponse.redirect(url);
  }

  if (user && isProtected) {
    const gate = await getProfileGate(supabase, user.id);

    // Approval gate (generator/third-party accounts only — see
    // 2026090601_add_approval_gate_to_profiles.sql and
    // 20260917_extend_approval_gate_to_third_party.sql): a pending account
    // who already has a session (e.g. just clicked their email
    // confirmation link) gets bounced to /pending-approval instead of
    // reaching any protected page.
    if (!gate.approved) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Manifest creation is the generator's responsibility (or an approved
    // third party's, scoped to their customer list — see
    // third_party_customers) — transporter/disposal accounts never create,
    // only sign/look up. Enforced here, not just by hiding the nav link, so
    // a direct URL hit is blocked too.
    if (
      request.nextUrl.pathname.startsWith("/manifests/new") &&
      (gate.accountType === "transporter" || gate.accountType === "disposal")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/manifests";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
