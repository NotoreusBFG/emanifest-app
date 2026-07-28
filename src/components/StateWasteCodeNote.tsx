import Link from "next/link";
import { getStateWasteCodeEntry, hasSupplementalStateWasteCodes } from "@/lib/stateWasteCodes";

/**
 * MTN-form heads-up: some states layer their own hazardous waste codes on
 * top of the federal D/F/K/P/U set (see src/lib/stateWasteCodes.ts). This
 * is informational only -- the form doesn't capture or submit a state
 * waste code yet, so this just tells the user to handle it themselves for
 * now (e.g. via the paper Item 13 process or their own RCRAInfo account).
 */
export function StateWasteCodeNote({ state }: { state: string }) {
  if (!hasSupplementalStateWasteCodes(state)) return null;
  const entry = getStateWasteCodeEntry(state);

  return (
    <p
      style={{
        fontSize: "13px",
        color: "#a15c00",
        background: "#fdf3e3",
        padding: "8px 12px",
        borderRadius: "6px",
        marginTop: "-8px",
        marginBottom: "16px",
      }}
    >
      ⚠ {entry?.stateName} adds its own hazardous waste codes on top of the federal ones — this
      manifest may need an additional state waste code that ManifestMate doesn&apos;t collect yet.{" "}
      <Link href="/university/state-waste-codes" target="_blank" style={{ color: "#a15c00", textDecoration: "underline" }}>
        See which codes apply →
      </Link>
    </p>
  );
}
