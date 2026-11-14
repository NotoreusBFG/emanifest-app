/**
 * Offline checks for the waste-line form parsing in src/lib/rcrainfo/buildManifestInput.ts. Unlike the other
 * scripts/test-*.ts files this makes no RCRAInfo or Supabase call, so it needs no credentials:
 *   npx tsx scripts/test-build-waste-lines.ts
 */
import assert from "node:assert/strict";
import { buildNewManifestInputFromFormData, buildWasteLinesFromFormData } from "../src/lib/rcrainfo/buildManifestInput";

type Line = Record<string, string>;

function form(lines: Record<string, Line>, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("wasteLineIds", Object.keys(lines).join(","));
  for (const [id, fields] of Object.entries(lines)) for (const [k, v] of Object.entries(fields)) fd.set(`${k}_${id}`, v);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const good: Line = { wasteDescription: "Spent solvent", quantity: "10", unitCode: "P", containerNumber: "1", containerTypeCode: "DM", federalWasteCode: "D001" };
// A prefilled, untouched slot: the form starts it with unit "P" and count "1" and nothing else.
const untouchedPrefill: Line = { unitCode: "P", containerNumber: "1" };

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}\n       ${(e as Error).message.split("\n").join("\n       ")}`);
    process.exitCode = 1;
  }
}

test("a complete line builds", () => {
  const r = buildWasteLinesFromFormData(form({ a: good }));
  assert.equal(r.error, undefined);
  assert.equal(r.wastes.length, 1);
});

test("an untouched prefilled slot is skipped, not an error", () => {
  const r = buildWasteLinesFromFormData(form({ a: good, b: untouchedPrefill }));
  assert.equal(r.error, undefined);
  assert.equal(r.wastes.length, 1);
});

test("a line with entries but no description is an error, not silently dropped", () => {
  const r = buildWasteLinesFromFormData(form({ a: good, b: { ...untouchedPrefill, quantity: "5", federalWasteCode: "D002", containerTypeCode: "DM" } }));
  assert.match(r.error ?? "", /add a description/);
});

test("a DOT-hazardous line with a UN number but no shipping name is an error", () => {
  const r = buildWasteLinesFromFormData(form({ a: good, b: { ...untouchedPrefill, dotHazardous: "on", idNumberCode: "UN1993" } }));
  assert.match(r.error ?? "", /add a description/);
});

test("container count must be a whole number", () => {
  const r = buildWasteLinesFromFormData(form({ a: { ...good, containerNumber: "2.5" } }));
  assert.match(r.error ?? "", /container count must be a whole number/);
});

test("container count cannot be negative", () => {
  const r = buildWasteLinesFromFormData(form({ a: { ...good, containerNumber: "-3" } }));
  assert.match(r.error ?? "", /container count must be a whole number/);
});

test("quantity decimals are still rejected (existing rule)", () => {
  const r = buildWasteLinesFromFormData(form({ a: { ...good, quantity: "1.5" } }));
  assert.match(r.error ?? "", /whole-number quantities/);
});

test("all-empty form asks for at least one waste line", () => {
  const r = buildWasteLinesFromFormData(form({ a: untouchedPrefill }));
  assert.match(r.error ?? "", /at least one waste line/);
});

test("missing wasteLineIds returns an error instead of throwing", () => {
  const r = buildWasteLinesFromFormData(new FormData());
  assert.match(r.error ?? "", /at least one waste line/);
});

test("missing transporterIds does not throw", () => {
  const r = buildNewManifestInputFromFormData(form({ a: good }));
  assert.equal(r.error, undefined);
  assert.deepEqual(r.input.transporters, []);
});

console.log(`\n${passed} tests passed${process.exitCode ? ", with failures" : ""}`);
