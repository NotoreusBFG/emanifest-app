"use client";

import { brand } from "@/lib/brandColors";

/**
 * Replaces the site's old pattern of a hardcoded "← [fixed destination]"
 * link on every page (one of which -- "← Settings" on the manifest lookup
 * and BOL lookup pages -- was flagged as an outright wrong destination).
 * Uses real browser history when there is any (so it returns wherever the
 * user actually came from, not always the same fixed page), and falls back
 * to `fallbackHref` only when there's nothing to go back to -- e.g. the page
 * was opened directly via a bookmark or shared link. `fallbackHref` should
 * be the same sensible parent page the old hardcoded link pointed to.
 */
export function BackButton({
  fallbackHref = "/dashboard",
  label = "← Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = fallbackHref;
        }
      }}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: brand.blue,
        cursor: "pointer",
        font: "inherit",
      }}
    >
      {label}
    </button>
  );
}
