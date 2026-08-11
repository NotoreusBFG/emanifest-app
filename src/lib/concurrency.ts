/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 *
 * First use case: fetching full manifest detail (one live RCRAInfo call
 * per MTN) for a batch of search results without hammering EPA's API or
 * risking a serverless function timeout on a large batch.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
