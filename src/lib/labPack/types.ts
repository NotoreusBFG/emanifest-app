export type PhysicalState = "liquid" | "solid" | "gas";
export type LabPackStatus = "draft" | "finalized";

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
