import { test } from "node:test";
import assert from "node:assert/strict";
import { NEAR_LIMIT_MS, RUN_LIMIT_MS, SLOW_AFTER_MS, runTimeHint } from "@/lib/client/runTimeHint";

test("example and mock runs keep the generic line at any time", () => {
  assert.equal(runTimeHint(0, { real: false }).text, "Usually a few minutes.");
  assert.equal(runTimeHint(NEAR_LIMIT_MS + 1, { real: false, region: "Atlanta, GA" }).tone, "normal");
});

test("real run without a place says 2 to 3 minutes", () => {
  assert.deepEqual(runTimeHint(10_000, { real: true }), { text: "Usually 2 to 3 minutes.", tone: "normal" });
  assert.equal(runTimeHint(5_000, { real: true, region: "   " }).text, "Usually 2 to 3 minutes.");
});

test("real run with a place names it", () => {
  assert.equal(
    runTimeHint(60_000, { real: true, region: " Atlanta, GA " }).text,
    "Usually about 3 minutes, including live prices for Atlanta, GA.",
  );
});

test("slow and near-limit lines take over as time passes", () => {
  assert.equal(runTimeHint(SLOW_AFTER_MS - 1, { real: true }).tone, "normal");
  assert.equal(runTimeHint(SLOW_AFTER_MS, { real: true }).tone, "slow");
  assert.equal(runTimeHint(NEAR_LIMIT_MS, { real: true, region: "Atlanta, GA" }).tone, "late");
  assert.match(runTimeHint(RUN_LIMIT_MS + 5_000, { real: true }).text, /5-minute limit/);
});

test("bad elapsed input reads as the start", () => {
  assert.equal(runTimeHint(Number.NaN, { real: true }).tone, "normal");
  assert.equal(runTimeHint(-1, { real: true }).tone, "normal");
});
