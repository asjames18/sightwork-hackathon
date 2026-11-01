/**
 * formatCountingOutlines (server log only, counting check): reports how many inventory counts
 * had no SAM outline and were marked estimated, so a real run shows whether the counting
 * check's "estimated" marks came from missing outlines. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatCountingOutlines } from "@/lib/pipeline/runPlan";

describe("formatCountingOutlines", () => {
  test("all counts outlined stays quiet", () => {
    assert.equal(formatCountingOutlines(3, 0), null);
  });

  test("one count without an outline is counted", () => {
    assert.equal(
      formatCountingOutlines(4, 1),
      "runPlan: counting: 1 of 4 counts had no outline, marked estimated",
    );
  });

  test("several counts without outlines are counted", () => {
    assert.equal(
      formatCountingOutlines(5, 3),
      "runPlan: counting: 3 of 5 counts had no outline, marked estimated",
    );
  });

  test("no inventory stays quiet", () => {
    assert.equal(formatCountingOutlines(0, 0), null);
  });

  test("no-outline above total stays quiet", () => {
    assert.equal(formatCountingOutlines(2, 3), null);
  });

  test("non-integer counts stay quiet", () => {
    assert.equal(formatCountingOutlines(3, 2.5), null);
  });

  test("negative counts stay quiet", () => {
    assert.equal(formatCountingOutlines(3, -1), null);
  });

  test("negative total stays quiet", () => {
    assert.equal(formatCountingOutlines(-1, 0), null);
  });
});
