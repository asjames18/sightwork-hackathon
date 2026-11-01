/** formatReasonSubsetSpacing (server log only, capped runs): reports the widest time gap between consecutive frames in the reason subset, so a real Large/XL run shows whether the reason step's frames are evenly spread or leave a long stretch of the walk unseen in time. Pure, no network, no plan output. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetSpacing } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetSpacing", () => {
  test("even spacing reports the first widest gap", () => {
    assert.equal(
      formatReasonSubsetSpacing([0, 10, 20, 30], [0, 1, 2, 3]),
      "runPlan: reason subset: max gap 10.0s between frames 0 and 1",
    );
  });

  test("uneven spacing names the widest pair", () => {
    assert.equal(
      formatReasonSubsetSpacing([0, 5, 25, 30], [0, 1, 3]),
      "runPlan: reason subset: max gap 25.0s between frames 1 and 3",
    );
  });

  test("a single frame stays quiet", () => {
    assert.equal(formatReasonSubsetSpacing([0, 10], [0]), null);
  });

  test("a non-finite time stays quiet", () => {
    assert.equal(
      formatReasonSubsetSpacing([0, Number.NaN, 20], [0, 1, 2]),
      null,
    );
  });

  test("an out-of-range subset index stays quiet", () => {
    assert.equal(formatReasonSubsetSpacing([0, 10], [0, 9]), null);
  });
});
