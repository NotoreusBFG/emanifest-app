import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90",
  secondary: "border-2 border-brand-blue text-brand-blue hover:bg-brand-tint",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  href?: string;
  children: ReactNode;
}

/**
 * Shared primary/secondary button from the MM1.1 design handoff
 * (design-handoff/mm1.1/README.md) — replaces the gradient-button style
 * previously hand-redefined in page.tsx, formStyles.ts, and
 * settings/page.tsx. Renders as a Link when `href` is passed, otherwise a
 * plain <button> forwarding the usual form/onClick props.
 */
export function Button({ variant = "primary", href, className = "", children, ...props }: ButtonProps) {
  const classes = `${BASE} ${VARIANT_CLASSES[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
