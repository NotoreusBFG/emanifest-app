import type { CSSProperties, ReactNode } from "react";

/**
 * Shared white surface component from the MM1.1 design handoff
 * (design-handoff/mm1.1/README.md) — the base container for app screens
 * that now sit on the brand-tint page background instead of bare white.
 */
export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl bg-white shadow-[0_2px_10px_rgba(10,34,70,0.06)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
