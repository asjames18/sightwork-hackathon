/**
 * formatCostPricing (server log only, planning step): reports how many materials the cost step
 * priced and how many of those prices are search-grounded, so a real run shows whether the
 * region-grounded cost range is fully priced or partly estimated. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatCostPricing } from "@/lib/pipeline/runPlan";

describe("formatCostPricing", () => {
  test("all materials priced and grounded stays quiet", () => {
    assert.equal(formatCostPricing(3, 3, 3), null);
  });

  test("unpriced materials are counted", () => {
    assert.equal(
      formatCostPricing(4, 3, 3),
      "runPlan: cost: 3/4 materials priced, 3 grounded",
    );
  });

  test("ungrounded prices are counted", () => {
    assert.equal(
      formatCostPricing(3, 3, 1),
      "runPlan: cost: 3/3 materials priced, 1 grounded",
    );
  });

  test("unpriced and ungrounded together", () => {
    assert.equal(
      formatCostPricing(5, 4, 2),
      "runPlan: cost: 4/5 materials priced, 2 grounded",
    );
  });

  test("no materials stays quiet", () => {
    assert.equal(formatCostPricing(0, 0, 0), null);
  });

  test("priced above total stays quiet", () => {
    assert.equal(formatCostPricing(2, 3, 1), null);
  });

  test("grounded above priced stays quiet", () => {
    assert.equal(formatCostPricing(3, 2, 3), null);
  });

  test("non-integer counts stay quiet", () => {
    assert.equal(formatCostPricing(3, 2.5, 1), null);
  });

  test("negative counts stay quiet", () => {
    assert.equal(formatCostPricing(3, -1, 0), null);
  });
});
