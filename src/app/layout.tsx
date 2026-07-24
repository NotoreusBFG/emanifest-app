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
        <header className="relative flex items-center justify-between px-6 py-6 sm:px-12">
          <Link href="/">
            <Image
              src="/manifestmate-logo.jpg"
              alt="ManifestMate"
              width={340}
              height={95}
              priority
            />
          </Link>
          {user ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="font-medium text-brand-blue hover:underline cursor-pointer bg-transparent border-none"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="font-medium text-brand-blue hover:underline">
              Sign in
            </Link>
          )}
        </header>
        <div className="relative flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
