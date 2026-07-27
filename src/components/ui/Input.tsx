import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

/**
 * Shared text/password input from the MM1.1 design handoff
 * (design-handoff/mm1.1/README.md).
 */
export function Input({ label, hint, id, className = "", ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-brand-navy">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue ${className}`}
        {...props}
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
