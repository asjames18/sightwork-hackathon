/** Usage tracker opts guard (src/lib/pipeline/usage.ts): a non-object
 * opts from a direct caller (a string, a number, an array, null) used
 * to be silently ignored — opts?.spikeCapUsd reads undefined off it,
 * so the tracker ran on defaults while the caller believed it had
 * set a cap. A non-object opts now throws a named usage error at
 * creation, the same named-error rule the record guard follows.
 * Omitted opts and a valid opts object still work. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createUsageTracker } from "@/lib/pipeline/usage";

describe("usage tracker opts guard", () => {
  test("createUsageTracker(null) throws a named usage error", () => {
    assert.throws(
      () => createUsageTracker(null as unknown as Parameters<typeof createUsageTracker>[0]),
      /usage: opts must be an object/,
    );
  });

  test("createUsageTracker('cap') and createUsageTracker(10) throw a named usage error", () => {
    assert.throws(
      () => createUsageTracker("cap" as unknown as Parameters<typeof createUsageTracker>[0]),
      /usage: opts must be an object/,
    );
    assert.throws(
      () => createUsageTracker(10 as unknown as Parameters<typeof createUsageTracker>[0]),
      /usage: opts must be an object/,
    );
  });

  test("createUsageTracker([]) throws a named usage error", () => {
    assert.throws(
      () => createUsageTracker([] as unknown as Parameters<typeof createUsageTracker>[0]),
      /usage: opts must be an object/,
    );
  });

  test("omitted opts still defaults, and a valid opts object still works", () => {
    const def = createUsageTracker();
    assert.equal(def.totals().remainingSpikeUsd, 10);
    const capped = createUsageTracker({ spikeCapUsd: 5 });
    assert.equal(capped.totals().remainingSpikeUsd, 5);
    const rec = capped.record({ model: "muse-spark", step: "reason", latencyMs: 10, costUsd: 0.05 });
    assert.equal(rec.model, "muse-spark");
    assert.equal(capped.totals().calls, 1);
  });
});
