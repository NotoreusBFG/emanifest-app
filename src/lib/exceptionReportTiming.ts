/**
 * Exception Report overdue alerts (40 CFR 262.42, as amended by the Third Rule).
 *
 * A generator who has not received the signed TSDF copy of a manifest must act
 * on a clock that runs from the day the initial transporter accepted the waste:
 *   - day 45: large quantity generators must search for the missing copy
 *     (contact the transporter / facility); small quantity generators are
 *     also advised to start checking here.
 *   - day 60: large AND small quantity generators must file an Exception Report.
 *     Since 12/1/2025 it is filed electronically in e-Manifest (Certifier role).
 *
 * Limits of this derivation (surfaced in the UI wording):
 *   - We only have the local mirror's signature timestamps. The clock start used
 *     is the generator signature (the earliest date we hold); the real start is
 *     the initial transporter's acceptance, which is the same day or later, so
 *     alerts can fire a little early but never late.
 *   - We do not know the generator's size. Very small quantity generators and
 *     PCB-only generators are not required to file. Wording says "if you are a
 *     small or large quantity generator".
 *   - The mirror can lag EPA; the alert asks the user to confirm in e-Manifest.
 */
export type ExceptionReportStage = "search" | "file";

export interface ExceptionReportAlert {
  stage: ExceptionReportStage;
  daysElapsed: number;
  daysToFile: number; // negative once past day 60
  label: string;
  detail: string;
}

export const EXCEPTION_SEARCH_DAYS = 45;
export const EXCEPTION_FILE_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getExceptionReportAlert(
  generatorSignedAt: string | null | undefined,
  transporterSignedAt: string | null | undefined,
  facilitySignedAt: string | null | undefined,
  epaStatus: string | null | undefined,
  now: number = Date.now()
): ExceptionReportAlert | null {
  if (facilitySignedAt) return null;
  if (epaStatus === "Deleted" || epaStatus === "Signed" || epaStatus === "Corrected") return null;
  const start = generatorSignedAt ?? transporterSignedAt;
  if (!start) return null;
  // Waste has not left the site until a transporter has signed; with no
  // transporter signature the clock has not started in any meaningful way.
  if (!transporterSignedAt) return null;

  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  const daysElapsed = Math.floor((now - startMs) / MS_PER_DAY);
  if (daysElapsed < EXCEPTION_SEARCH_DAYS) return null;

  const daysToFile = EXCEPTION_FILE_DAYS - daysElapsed;
  if (daysElapsed >= EXCEPTION_FILE_DAYS) {
    return {
      stage: "file",
      daysElapsed,
      daysToFile,
      label: "Exception Report due",
      detail: `${daysElapsed} days since this shipment was signed and no signed facility copy is on record. Small and large quantity generators must file an Exception Report in e-Manifest (Certifier role) by day ${EXCEPTION_FILE_DAYS}. Confirm in e-Manifest first, since this list can lag EPA.`,
    };
  }
  return {
    stage: "search",
    daysElapsed,
    daysToFile,
    label: `Find signed copy (${daysToFile}d to file)`,
    detail: `${daysElapsed} days since this shipment was signed and no signed facility copy is on record. Large quantity generators must search for the missing copy now; an Exception Report is due at day ${EXCEPTION_FILE_DAYS} (${daysToFile} days left).`,
  };
}
