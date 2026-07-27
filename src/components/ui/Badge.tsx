import type { ReactNode } from "react";
import { badgeColors } from "@/lib/brandColors";

export type BadgeVariant = keyof typeof badgeColors;

/**
 * Pill-shaped status label from the MM1.1 design handoff
 * (design-handoff/mm1.1/README.md) — see `src/lib/manifestStatusBadge.ts`
 * for how the manifest lifecycle variant is derived.
 */
export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  const { bg, text } = badgeColors[variant];

  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: bg, color: text }}
    >
      {children}
    </span>
  );
}
