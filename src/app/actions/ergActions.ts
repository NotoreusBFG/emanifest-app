"use server";

import { lookupErgGuide } from "@/lib/hazmat/ergLookup";
import type { ErgLookupResult } from "@/lib/hazmat/ergLookup";

/**
 * Called from the waste profile form when the ERG toggle is switched on.
 * Local lookup over the bundled PHMSA ERG2024 table (docs/erg-guide-numbers.json,
 * ~440KB) -- kept server-side only so that data isn't shipped to the client
 * bundle, same reasoning as searchHazmatAction.
 */
export async function lookupErgNumberAction(
  idNumberCode: string,
  properShippingName?: string
): Promise<ErgLookupResult> {
  return lookupErgGuide(idNumberCode, properShippingName);
}
