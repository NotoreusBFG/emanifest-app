/**
 * Surfaces elapsed time since the last transporter signed, relative to the
 * 49 CFR transporter-to-facility timing window this project's own
 * NEXT_SESSION.md flagged as a bigger future feature (full relay-shipment
 * modeling deferred; this is just the simple "how long has this been in
 * transit" surface the user asked for first). `transporterSignedAt` should
 * be the LATEST of all transporters' signature dates on a multi-transporter
 * manifest, not just the first — same convention already used by
 * `manifests.transporter_signed_at` in the local mirror.
 */
export type TransporterTimingSeverity = "ok" | "warning" | "over";

export interface TransporterTimingInfo {
  hours: number;
  /** Whether the designated facility has already signed (clock stopped) or
   * this is still ongoing (clock running, computed against now). */
  delivered: boolean;
  severity: TransporterTimingSeverity;
}

const WARNING_HOURS = 48;
const OVER_HOURS = 72;

export function getTransporterTimingInfo(
  transporterSignedAt: string | null | undefined,
  facilitySignedAt: string | null | undefined
): TransporterTimingInfo | null {
  if (!transporterSignedAt) return null;

  const start = new Date(transporterSignedAt).getTime();
  const delivered = !!facilitySignedAt;
  const end = delivered ? new Date(facilitySignedAt!).getTime() : Date.now();
  const hours = Math.max(0, (end - start) / (1000 * 60 * 60));

  const severity: TransporterTimingSeverity = hours >= OVER_HOURS ? "over" : hours >= WARNING_HOURS ? "warning" : "ok";

  return { hours, delivered, severity };
}

export function formatElapsedHours(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainderHours = Math.round(hours % 24);
  return remainderHours > 0 ? `${days}d ${remainderHours}h` : `${days}d`;
}

export const TRANSPORTER_TIMING_COLOR: Record<TransporterTimingSeverity, string> = {
  ok: "#666",
  warning: "#a15c00",
  over: "#c0392b",
};
