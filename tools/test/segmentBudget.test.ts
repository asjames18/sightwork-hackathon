/** formatSegmentBudget (server log only, cap-bit runs): reports when the SAM request cap bit on the segment step, so a real Large/XL run shows whether the 300-request cap is the binding constraint for the held cap-scaling decision. Pure, no network, no plan output. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatSegmentBudget } from "@/lib/pipeline/runPlan";

describe("formatSegmentBudget", () => {
  test("budget exceeded with dropped labels names them", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, ["ladder", "bucket"]),
      "runPlan: segment: cap bit: 300 SAM requests on 48 frames, 22 flagged, dropped labels: ladder, bucket",
    );
  });

  test("budget exceeded without dropped labels omits the labels part", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, []),
      "runPlan: segment: cap bit: 300 SAM requests on 48 frames, 22 flagged",
    );
  });

  test("quiet run stays quiet", () => {
    assert.equal(formatSegmentBudget(48, 120, 22, false, []), null);
  });

  test("dropped labels log even without the exceeded flag", () => {
    assert.equal(
      formatSegmentBudget(48, 290, 22, false, ["ladder"]),
      "runPlan: segment: cap bit: 290 SAM requests on 48 frames, 22 flagged, dropped labels: ladder",
    );
  });

  test("malformed counts stay quiet", () => {
    assert.equal(formatSegmentBudget(48, -1, 22, true, ["ladder"]), null);
  });
});
