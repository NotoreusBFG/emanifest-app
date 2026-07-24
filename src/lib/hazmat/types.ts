/**
 * Structured form of the 49 CFR §172.101 Hazardous Materials Table.
 * Field names/order match the table's own numbered columns (1)-(10B).
 */
export interface HazmatEntry {
  /** Column (1) — e.g. "A", "D", "G", "I", "W". Blank for most entries. */
  symbols: string;
  /** Column (2) — proper shipping name / hazardous materials description. */
  properShippingName: string;
  /** Column (3). */
  hazardClass: string;
  /** Column (4) — e.g. "UN1993". */
  idNumbers: string;
  /** Column (5) — Roman numeral I/II/III, or blank. */
  packingGroup: string;
  /** Column (6) — comma-separated label codes. */
  labelCodes: string;
  /** Column (7) — references into §172.102. */
  specialProvisions: string;
  packaging: {
    /** Column (8A) — §173.*** exceptions. */
    exceptions: string;
    /** Column (8B). */
    nonBulk: string;
    /** Column (8C). */
    bulk: string;
  };
  quantityLimitations: {
    /** Column (9A). */
    passengerAircraftRail: string;
    /** Column (9B). */
    cargoAircraftOnly: string;
  };
  vesselStowage: {
    /** Column (10A). */
    location: string;
    /** Column (10B). */
    other: string;
  };
  /**
   * True for alphabetization-only rows like "Accellerene, see
   * p-Nitrosodimethylaniline" — no hazard class/ID number of their own,
   * just a pointer to the real entry under another name. Still useful for
   * name-based search (a user searching "Accellerene" should be pointed at
   * the right entry), but should never be used as the actual DOT
   * classification for a waste line.
   */
  isCrossReference: boolean;
}
