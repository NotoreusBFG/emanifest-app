"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
    >
      Print this label
    </button>
  );
}
