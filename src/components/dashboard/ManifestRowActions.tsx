"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brandColors";

/**
 * MM1.1 design handoff (design-handoff/mm1.1/README.md): consolidates the
 * dashboard row's print/view-LDR/create-LDR actions behind a single "⋯"
 * trigger instead of 3 separate inline icon buttons. Purely a presentation
 * change — same links, same targets, same permissions as before.
 */
export function ManifestRowActions({
  mtn,
  hasDocuments,
  ldrNoticeId,
}: {
  mtn: string;
  hasDocuments: boolean;
  ldrNoticeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-brand-navy hover:bg-brand-tint"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
        >
          {hasDocuments && (
            <Link
              href={`/api/manifests/${encodeURIComponent(mtn)}/attachments`}
              role="menuitem"
              className="block px-4 py-2 text-sm text-brand-navy hover:bg-brand-tint"
              onClick={() => setOpen(false)}
            >
              🖨️ View/print signed manifest
            </Link>
          )}
          {ldrNoticeId && (
            <Link
              href={`/ldr/${ldrNoticeId}`}
              role="menuitem"
              className="block px-4 py-2 text-sm text-brand-navy hover:bg-brand-tint"
              onClick={() => setOpen(false)}
            >
              📋 View/print LDR notice
            </Link>
          )}
          <Link
            href={`/ldr/new?mtn=${encodeURIComponent(mtn)}`}
            role="menuitem"
            className="block px-4 py-2 text-sm hover:bg-brand-tint"
            style={{ color: brand.blue }}
            onClick={() => setOpen(false)}
          >
            + Create LDR notice
          </Link>
        </div>
      )}
    </div>
  );
}
