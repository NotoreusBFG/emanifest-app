import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { HAZ_WASTE_UNIVERSITY_HOSTS } from "@/lib/hazWasteHosts";

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
