import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/authActions";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-12 bg-brand-tint/95 backdrop-blur-sm shadow-sm">
          <Link href="/" className="shrink-0">
            <Image
              src="/manifestmate-logo.jpg"
              alt="ManifestMate"
              width={220}
              height={62}
              priority
            />
          </Link>

          {user ? (
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
              <Link href="/dashboard" className="text-brand-navy hover:text-brand-blue">
                Dashboard
              </Link>
              <Link href="/manifests/new" className="text-brand-navy hover:text-brand-blue">
                Create manifest
              </Link>
              <Link href="/manifests" className="text-brand-navy hover:text-brand-blue">
                Look up manifest
              </Link>
              <Link href="/settings" className="text-brand-navy hover:text-brand-blue">
                Settings
              </Link>
              <Link href="/faq" className="text-brand-navy hover:text-brand-blue">
                FAQ
              </Link>
            </nav>
          ) : (
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
              <Link href="/faq" className="text-brand-navy hover:text-brand-blue">
                FAQ
              </Link>
            </nav>
          )}

          {user ? (
            <form action={signOutAction} className="shrink-0">
              <button
                type="submit"
                className="font-medium text-brand-blue hover:underline cursor-pointer bg-transparent border-none"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="shrink-0 font-medium text-brand-blue hover:underline">
              Sign in
            </Link>
          )}
        </header>
        <div className="relative flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
