/** usage.record input guard: a null, undefined, or non-object input
 * throws a named usage error, not a raw TypeError surfacing
 * "cannot read properties of null" — the same named-error rule the
 * field checks already follow. A valid record still works.
 * No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createUsageTracker } from "@/lib/pipeline/usage";

describe("usage.record input guard", () => {
  test("record(null) throws a named usage error", () => {
    const tracker = createUsageTracker();
    assert.throws(
      () => (tracker.record as (x: unknown) => unknown)(null),
      /usage: record input must be an object/,
    );
  });

  test("record(undefined) and record('x') throw a named usage error", () => {
    const tracker = createUsageTracker();
    assert.throws(
      () => (tracker.record as (x: unknown) => unknown)(undefined),
      /usage: record input must be an object/,
    );
    assert.throws(
      () => (tracker.record as (x: unknown) => unknown)("x"),
      /usage: record input must be an object/,
    );
  });

  test("a valid record still records after the guard", () => {
    const tracker = createUsageTracker();
    const rec = tracker.record({ model: "muse-spark", step: "reason", latencyMs: 10, costUsd: 0.05 });
    assert.equal(rec.model, "muse-spark");
    assert.equal(tracker.totals().calls, 1);
  });
});
