/**
 * Offline checks that the dashboard's id-keyed lookups split long id lists into small requests and still merge
 * correctly. No Supabase or RCRAInfo call: a fake query builder records every `.in(...)` list it is given.
 *   npx tsx scripts/test-batched-lookups.ts
 */
import assert from "node:assert/strict";
import { chunk, IN_FILTER_BATCH_SIZE } from "../src/lib/batch";
import { listManifestIdsWithDocuments } from "../src/services/manifestRepository";
import { listDriverSignInfoByMtn } from "../src/services/driverSignRepository";
import { listGeneratorSignInfoByMtn } from "../src/services/generatorSignRepository";

type Row = Record<string, unknown>;

/** Chainable fake: `.in(col, ids)` filters the table's rows to those ids and records the list; awaiting it returns the rows. */
function fakeSupabase(tables: Record<string, Row[]>, opts: { failOnBatch?: number } = {}) {
  const inCalls: string[][] = [];
  const client = {
    from(table: string) {
      let rows = tables[table] ?? [];
      let batchNo = -1;
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        not: () => q,
        is: () => q,
        order: () => q,
        in: (col: string, ids: string[]) => {
          inCalls.push(ids);
          batchNo = inCalls.length - 1;
          rows = rows.filter((r) => ids.includes(r[col] as string));
          return q;
        },
        then: (resolve: (v: unknown) => void) =>
          resolve(opts.failOnBatch === batchNo ? { data: null, error: { message: "boom" } } : { data: rows, error: null }),
      };
      return q;
    },
  };
  return { client: client as never, inCalls };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}\n       ${(e as Error).message.split("\n").join("\n       ")}`);
    process.exitCode = 1;
  }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
const mtns = (n: number) => Array.from({ length: n }, (_, i) => `${String(100000000 + i)}ELC`);

(async () => {
  await test("chunk splits into batches no larger than the size, in order, losing nothing", () => {
    const parts = chunk(ids(401), 150);
    assert.deepEqual(parts.map((p) => p.length), [150, 150, 101]);
    assert.deepEqual(parts.flat(), ids(401));
    assert.deepEqual(chunk([], 150), []);
  });
  await test("chunk rejects a bad size instead of looping forever", () => {
    assert.throws(() => chunk([1, 2, 3], 0));
    assert.throws(() => chunk([1, 2, 3], 1.5));
  });

  await test("manifest documents: 1200 manifests -> no request carries more than one batch of ids, every hit is found", async () => {
    const all = ids(1200);
    const withDocs = [all[0], all[149], all[150], all[777], all[1199]];
    const { client, inCalls } = fakeSupabase({ manifest_documents: withDocs.map((id) => ({ manifest_id: id })) });
    const found = await listManifestIdsWithDocuments(client, all);
    assert.ok(inCalls.length > 1, "expected more than one request");
    assert.ok(inCalls.every((c) => c.length <= IN_FILTER_BATCH_SIZE), "a request carried an oversized id list");
    assert.deepEqual([...found].sort(), [...withDocs].sort());
  });

  await test("manifest documents: empty list makes no request", async () => {
    const { client, inCalls } = fakeSupabase({});
    assert.equal((await listManifestIdsWithDocuments(client, [])).size, 0);
    assert.equal(inCalls.length, 0);
  });

  await test("manifest documents: a failed batch returns an empty set, like the single-request version did", async () => {
    const all = ids(400);
    const { client } = fakeSupabase({ manifest_documents: [{ manifest_id: all[0] }] }, { failOnBatch: 1 });
    assert.equal((await listManifestIdsWithDocuments(client, all)).size, 0);
  });

  await test("driver sign info: newest row per MTN wins across batches", async () => {
    const all = mtns(400);
    const rows = [
      { epa_mtn: all[5], printed_signature_name: "New Driver", driver_id_number: "1", truck_number: "T1", acknowledged_at: "2026-02-01" },
      { epa_mtn: all[5], printed_signature_name: "Old Driver", driver_id_number: "2", truck_number: "T2", acknowledged_at: "2026-01-01" },
      { epa_mtn: all[390], printed_signature_name: "Late Batch", driver_id_number: "3", truck_number: "T3", acknowledged_at: "2026-03-01" },
    ];
    const { client, inCalls } = fakeSupabase({ signature_consents: rows });
    const map = await listDriverSignInfoByMtn(client, all);
    assert.ok(inCalls.every((c) => c.length <= IN_FILTER_BATCH_SIZE));
    assert.equal(map[all[5]].driverName, "New Driver");
    assert.equal(map[all[390]].driverName, "Late Batch");
  });

  await test("generator sign info: finds rows in every batch", async () => {
    const all = mtns(500);
    const rows = [all[0], all[200], all[499]].map((m, i) => ({ epa_mtn: m, printed_signature_name: `G${i}`, acknowledged_at: "2026-01-01" }));
    const { client } = fakeSupabase({ signature_consents: rows });
    const map = await listGeneratorSignInfoByMtn(client, all);
    assert.deepEqual(Object.keys(map).sort(), [all[0], all[200], all[499]].sort());
  });

  console.log(`\n${passed} tests passed${process.exitCode ? ", with failures" : ""}`);
})();
