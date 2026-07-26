/**
 * Manifest data import — Option B from docs/manifest-data-import-design.md
 * (a generator importing their own ERP/LIMS export). Pre-fill only: this
 * shape only ever populates the existing manifest creation form's state,
 * exactly as if a human had typed it — nothing here is submitted to EPA
 * directly. See that design doc for Options A/C (broker submission,
 * general third-party API), which are NOT built.
 */

export interface ImportedParty {
  epaSiteId: string;
  name?: string;
}

export interface ImportedTransporter extends ImportedParty {
  order: number;
}

export interface ImportedWasteLine {
  description: string;
  dotHazardous: boolean;
  hazardClass?: string;
  packingGroup?: string;
  idNumberCode?: string;
  rqIndicator?: boolean;
  quantity: number;
  unitCode: string;
  containerNumber: number;
  containerTypeCode: string;
  federalWasteCodes?: string[];
}

export interface ImportedManifestPayload {
  generator: ImportedParty;
  transporters: ImportedTransporter[];
  designatedFacility: ImportedParty;
  wastes: ImportedWasteLine[];
}

export type ManifestImportResult =
  | { success: true; payload: ImportedManifestPayload }
  | { success: false; errors: string[] };
