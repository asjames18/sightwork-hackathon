/** formatReasonRemapDropped (server log only, capped runs): reports when the remap from subset positions back to plan frames drops an issue or a watch entry, so a real Large/XL run shows whether the reason step's output survived the subset. Pure, no network, no plan output. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonRemapDropped } from "@/lib/pipeline/runPlan";

describe("formatReasonRemapDropped", () => {
  test("dropped issues are named with their before count", () => {
    assert.equal(
      formatReasonRemapDropped(6, 5, 2, 2),
      "runPlan: reason remap: dropped 1 of 6 issues",
    );
  });

  test("dropped watch entries are named with their before count", () => {
    assert.equal(
      formatReasonRemapDropped(6, 6, 3, 1),
      "runPlan: reason remap: dropped 2 of 3 watch entries",
    );
  });

  test("both drops join in one line", () => {
    assert.equal(
      formatReasonRemapDropped(6, 4, 3, 2),
      "runPlan: reason remap: dropped 2 of 6 issues, dropped 1 of 3 watch entries",
    );
  });

  test("nothing dropped stays quiet", () => {
    assert.equal(formatReasonRemapDropped(6, 6, 2, 2), null);
  });

  test("an after count above its before count stays quiet", () => {
    assert.equal(formatReasonRemapDropped(5, 6, 2, 2), null);
  });

  test("a non-integer count stays quiet", () => {
    assert.equal(formatReasonRemapDropped(Number.NaN, 1, 0, 0), null);
  });
});
