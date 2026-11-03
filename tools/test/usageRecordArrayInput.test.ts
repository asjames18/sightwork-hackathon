/** usage.record array-input guard (src/lib/pipeline/usage.ts): an
 * array slips past the null/non-object check (arrays are objects),
 * so one carrying every field — including a parseable at, which
 * overrides Array.prototype.at — was recorded as a call, and any
 * other array threw a misleading field error instead of the named
 * input error. Such inputs now throw a named usage error, while a
 * valid record still records. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createUsageTracker } from "@/lib/pipeline/usage";

describe("usage.record array input guard", () => {
  test("an array carrying every field throws a named usage error", () => {
    const tracker = createUsageTracker();
    const arr = [] as unknown as Record<string, unknown>;
    arr.model = "muse-spark";
    arr.step = "reason";
    arr.latencyMs = 10;
    arr.costUsd = 0.05;
    arr.at = "2026-11-03T00:00:00.000Z";
    assert.throws(
      () => (tracker.record as (x: unknown) => unknown)(arr),
      /usage: record input must be an object, got array/,
    );
    assert.equal(tracker.totals().calls, 0);
  });

  test("an empty array throws a named usage error, not a field error", () => {
    const tracker = createUsageTracker();
    assert.throws(
      () => (tracker.record as (x: unknown) => unknown)([]),
      /usage: record input must be an object, got array/,
    );
  });

  test("a valid record still records after the guard", () => {
    const tracker = createUsageTracker();
    const rec = tracker.record({ model: "muse-spark", step: "reason", latencyMs: 10, costUsd: 0.05 });
    assert.equal(rec.model, "muse-spark");
    assert.equal(tracker.totals().calls, 1);
  });
});
