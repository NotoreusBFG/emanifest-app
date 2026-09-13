export type PhysicalState = "liquid" | "solid" | "gas";
export type LabPackStatus = "draft" | "finalized";
export type LabPackJobStatus = "open" | "ready" | "linked" | "archived";

export interface LabPackLineItem {
  id: string;
  lineNumber: number;
  chemicalName: string;
  quantity: number | null;
  containerSize: string;
  physicalState: PhysicalState | null;
  epaWasteCodes: string[];
  sourceLocation: string;
  notes: string;
}

export interface LabPackLineItemInput {
  lineNumber: number;
  chemicalName: string;
  quantity: number | null;
  containerSize: string;
  physicalState: PhysicalState | null;
  epaWasteCodes: string[];
  sourceLocation: string;
  notes: string;
}

export interface LabPack {
  id: string;
  /** The lab_pack_jobs batch this drum belongs to, if any -- null for a
   * non-hazardous one-off or a pre-phase-2 "legacy" drum. Distinct from
   * jobNumber below, which is a free-text external reference. */
  jobId: string | null;
  jobNumber: string;
  generatorEpaId: string;
  generatorName: string;
  generatorAddress: string;
  isNonHazardous: boolean;
  dotShippingDescription: string;
  dotSpecialPermitNumber: string;
  rqIndicator: boolean;
  rqCodes: string;
  wasteCodes: string[];
  totalWeight: number | null;
  outerContainerTypeCode: string;
  outerContainerSize: string;
  drumNumber: number | null;
  epaMtn: string | null;
  manifestLineNumber: number | null;
  status: LabPackStatus;
  lineItems: LabPackLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LabPackInput {
  jobId: string | null;
  jobNumber: string;
  generatorEpaId: string;
  generatorName: string;
  generatorAddress: string;
  isNonHazardous: boolean;
  dotShippingDescription: string;
  dotSpecialPermitNumber: string;
  rqIndicator: boolean;
  rqCodes: string;
  totalWeight: number | null;
  outerContainerTypeCode: string;
  outerContainerSize: string;
  drumNumber: number | null;
  status: LabPackStatus;
  lineItems: LabPackLineItemInput[];
}

/** A batch of drums prepped for one generator, referenced by ManifestMate's
 * own "LP-000001" number -- lets a third-party lab-pack service group work
 * before any manifest/MTN exists, then bulk-load the whole batch onto a
 * manifest once one does. */
export interface LabPackJob {
  id: string;
  jobNumber: string;
  jobName: string;
  generatorEpaId: string;
  generatorName: string;
  generatorAddress: string;
  status: LabPackJobStatus;
  epaMtn: string | null;
  /** Count of lab_packs rows currently linked to this job -- computed by
   * the repository via an embedded count query, not a real column. */
  drumCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LabPackJobInput {
  jobName: string;
  generatorEpaId: string;
  generatorName: string;
  generatorAddress: string;
  status: LabPackJobStatus;
}

/** Outer container size options shown on the reference vendor form
 * (5/10/16/30/55 gallon drums, or "PIH" for a poison-inhalation-hazard
 * drum needing special handling). Free values are still accepted --
 * this just seeds the picker. */
export const OUTER_CONTAINER_SIZE_OPTIONS = ["5", "10", "16", "30", "55", "PIH"] as const;

export const PHYSICAL_STATE_OPTIONS: { value: PhysicalState; label: string }[] = [
  { value: "liquid", label: "Liquid" },
  { value: "solid", label: "Solid" },
  { value: "gas", label: "Gas" },
];
