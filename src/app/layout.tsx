import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/authActions";
import { getAccountType } from "@/services/profileRepository";
import { getFeatureFlag } from "@/services/featureFlagRepository";
import { isAdminEmail } from "@/lib/admin";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ManifestMate — Hazardous Waste Manifests, Simplified",
  description:
    "Create, sign, and track EPA e-Manifests without the paperwork headache. Guided setup for generators new to hazardous waste manifesting.",
};

type NavLink = { href: string; label: string };

const GENERATOR_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Get set up with EPA" },
  { href: "/manifests/new", label: "Create manifest" },
  { href: "/manifests", label: "Look up manifest" },
  { href: "/ldr", label: "LDR notices" },
  { href: "/transporters", label: "Transporters" },
  { href: "/settings", label: "Settings" },
  { href: "/university", label: "Haz Waste University" },
  { href: "/faq", label: "FAQ" },
];

const TRANSPORTER_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/transporter-dashboard", label: "Dashboard" },
  { href: "/university", label: "Haz Waste University" },
  { href: "/faq", label: "FAQ" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gates the multi-role account UI (sidebar nav, transporter dashboard,
  // role-based nav) — off means every logged-in user sees today's single
  // top-nav layout regardless of their actual account_type. See /admin.
  const mm2Enabled = user ? await getFeatureFlag(supabase, "mm2_ui") : false;
  const accountType = user && mm2Enabled ? await getAccountType(supabase, user.id) : "generator";
  const adminLink = isAdminEmail(user?.email) ? [{ href: "/admin", label: "Admin" }] : [];
  const navLinks = [
    ...(accountType === "transporter" ? TRANSPORTER_NAV_LINKS : GENERATOR_NAV_LINKS),
    ...adminLink,
  ];

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-brand-tint relative">
        <div
          aria-hidden
          className="pointer-events-none fixed -left-32 -bottom-32 h-96 w-[40rem] rounded-full bg-gradient-to-r from-brand-blue to-brand-green opacity-20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed -right-32 -top-32 h-96 w-[40rem] rounded-full bg-gradient-to-r from-brand-green to-brand-teal opacity-10 blur-3xl"
        />
        {user && mm2Enabled ? (
          <div className="flex flex-1">
            <aside className="no-print hidden sm:sticky sm:top-0 sm:flex sm:h-screen sm:w-56 sm:shrink-0 sm:flex-col sm:gap-6 sm:overflow-y-auto sm:border-r sm:border-brand-navy/10 sm:bg-brand-tint/95 sm:px-4 sm:py-6 sm:backdrop-blur-sm">
              <Link href="/" className="shrink-0">
                <Image
                  src="/manifestmate-logo.jpg"
                  alt="ManifestMate"
                  width={160}
                  height={45}
                  priority
                />
              </Link>

              <nav className="flex flex-col gap-1 text-sm font-medium">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-brand-navy hover:bg-brand-blue/10 hover:text-brand-blue"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-0.5 border-t border-brand-navy/10 pt-4">
                <span className="text-xs text-brand-navy/70 break-all">{user.email}</span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="font-medium text-brand-blue hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
              <header className="no-print sm:hidden sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-brand-tint/95 backdrop-blur-sm shadow-sm">
                <Link href="/" className="shrink-0">
                  <Image
                    src="/manifestmate-logo.jpg"
                    alt="ManifestMate"
                    width={220}
                    height={62}
                    priority
                  />
                </Link>

                <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="text-brand-navy hover:text-brand-blue">
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-xs text-brand-navy/70">{user.email}</span>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="font-medium text-brand-blue hover:underline cursor-pointer bg-transparent border-none"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </header>

              <div className="relative flex-1 flex flex-col">{children}</div>
            </div>
          </div>
        ) : user ? (
          // mm2_ui flag OFF: today's production layout — single top header,
          // no sidebar, no role-based nav — regardless of account_type.
          <>
            <header className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-12 bg-brand-tint/95 backdrop-blur-sm shadow-sm">
              <Link href="/" className="shrink-0">
                <Image
                  src="/manifestmate-logo.jpg"
                  alt="ManifestMate"
                  width={220}
                  height={62}
                  priority
                />
              </Link>

              <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="text-brand-navy hover:text-brand-blue">
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-xs text-brand-navy/70">{user.email}</span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="font-medium text-brand-blue hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </header>
            <div className="relative flex-1 flex flex-col">{children}</div>
          </>
        ) : (
          <>
            <header className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-12 bg-brand-tint/95 backdrop-blur-sm shadow-sm">
              <Link href="/" className="shrink-0">
                <Image
                  src="/manifestmate-logo.jpg"
                  alt="ManifestMate"
                  width={220}
                  height={62}
                  priority
                />
              </Link>

              <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
                <Link href="/" className="text-brand-navy hover:text-brand-blue">
                  Home
                </Link>
                <Link href="/university" className="text-brand-navy hover:text-brand-blue">
                  Haz Waste University
                </Link>
                <Link href="/faq" className="text-brand-navy hover:text-brand-blue">
                  FAQ
                </Link>
              </nav>

              <Link href="/login" className="shrink-0 font-medium text-brand-blue hover:underline">
                Sign in
              </Link>
            </header>
            <div className="relative flex-1 flex flex-col">{children}</div>
          </>
        )}
      </body>
    </html>
  );
}
