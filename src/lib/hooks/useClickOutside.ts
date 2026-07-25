import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onOutsideClick` when a mousedown lands outside the given ref's
 * element. Extracted after the same mousedown/containerRef pattern showed
 * up independently in SiteSearchField, HazmatSearchField, and
 * FederalWasteCodeField — all three close their dropdown this way.
 *
 * Callers typically pass an inline arrow function (`() => setIsOpen(false)`),
 * a fresh reference every render — so the callback is read through a ref
 * instead of sitting in the effect's dependency array. That keeps the
 * mousedown listener attached once for the component's lifetime rather than
 * being torn down and re-added on every render, without pushing a
 * `useCallback` requirement onto every call site.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void) {
  const callbackRef = useRef(onOutsideClick);
  callbackRef.current = onOutsideClick;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref]);
}
