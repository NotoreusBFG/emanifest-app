/**
 * Derives the MM1.1 design handoff's manifest lifecycle status badge
 * (design-handoff/mm1.1/README.md) from the existing G/T/F signature
 * timestamps already stored on the local `manifests` mirror — no new
 * column. Reuses `transporterTiming.ts`'s elapsed-time math (same
 * "latest transporter signature" convention) rather than re-deriving it.
 *
 * The design also specifies a fifth "Rejected → rerouted to <MTN>"
 * variant, but that requires a new manifest-to-manifest linkage
 * (nothing today models a rejected manifest's replacement MTN) — this
 * project's own NEXT_SESSION notes already decided to document that
 * flow rather than build it yet, so it's deliberately not derived here.
 * `BadgeVariant` (in Badge.tsx) still has a `rejected` color ready for
 * whenever that linkage gets built.
 */
import { getTransporterTimingInfo } from "./transporterTiming";
import type { BadgeVariant } from "@/components/ui/Badge";

const OVERDUE_HOURS = 10 * 24;

export interface ManifestBadgeInfo {
  variant: BadgeVariant;
  label: string;
}

export function deriveManifestBadge(
  generatorSignedAt: string | null,
  transporterSignedAt: string | null,
  facilitySignedAt: string | null
): ManifestBadgeInfo | null {
  if (facilitySignedAt) {
    return { variant: "received", label: "Received" };
  }

  if (transporterSignedAt) {
    const timing = getTransporterTimingInfo(transporterSignedAt, facilitySignedAt);
    if (timing && !timing.delivered && timing.hours >= OVERDUE_HOURS) {
      return { variant: "overdue", label: "Overdue" };
    }
    return { variant: "in_transit", label: "In transit" };
  }

  if (generatorSignedAt) {
    return { variant: "scheduled", label: "Scheduled" };
  }

  return null;
}
