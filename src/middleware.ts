import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// hazwastemanifestmate.com is being test-driven as a dedicated landing
// domain for Haz Waste University — the homepage there shows the
// university section instead of the regular product homepage. Every other
// path still resolves normally, so the domain works as a full alias if it
// ever becomes the primary URL.
const HAZ_WASTE_UNIVERSITY_HOSTS = ["hazwastemanifestmate.com", "www.hazwastemanifestmate.com"];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  if (
    HAZ_WASTE_UNIVERSITY_HOSTS.includes(request.nextUrl.hostname) &&
    request.nextUrl.pathname === "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/university";
    const rewritten = NextResponse.rewrite(url);
    response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
    return rewritten;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
