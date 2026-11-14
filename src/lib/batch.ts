/**
 * Splits a long id list so a PostgREST `.in(...)` filter stays inside the URL length a single request can carry.
 * leadsRepository.ts found that one request's id list "stops working outright" somewhere north of ~500 UUIDs; 150
 * keeps a UUID list near 6 KB. Every id lands in exactly one batch, so merging the batches' rows by id is safe.
 */
export const IN_FILTER_BATCH_SIZE = 150;

export function chunk<T>(items: T[], size: number = IN_FILTER_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
