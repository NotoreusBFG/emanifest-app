"use client";

import { useState } from "react";
import { LANDING_VIDEO_URL } from "@/lib/landingVideo";

/**
 * Short explainer for the landing page's "Getting started" section -- same
 * poster-then-play pattern as the onboarding wizard's videos
 * (src/app/onboarding/page.tsx), reused here for visual consistency across
 * the app. Source video is landscape (1280x720), matching the onboarding
 * videos' 16:9 frame.
 */
export function LandingVideo() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-2xl bg-brand-navy shadow-sm">
      {isPlaying ? (
        <video
          src={LANDING_VIDEO_URL}
          controls
          autoPlay
          className="h-full w-full object-contain bg-brand-navy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label="Play video: why go digital with e-Manifest"
          className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 bg-brand-tint px-6 text-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small static brand asset, not worth next/image's overhead inside a poster overlay */}
          <img src="/manifestmate-logo.jpg" alt="" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-brand-navy">
            Why go digital with e-Manifest?
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-brand-blue to-brand-green shadow-sm">
            <span
              className="ml-1 h-0 w-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white"
              aria-hidden
            />
          </span>
        </button>
      )}
    </div>
  );
}
