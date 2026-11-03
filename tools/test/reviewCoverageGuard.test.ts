/** formatReviewCoverage malformed-input guard (server log only, reviewing
 * step): the sibling diagnostic lines all stay quiet on malformed
 * input, and this one threw on a non-array side (a number or null in
 * .map/.filter), a null issue (on .frameIndex), and a non-array
 * proofFrames side or a null proof entry (in .map) instead of staying
 * quiet. Malformed inputs now return null, the same quiet rule. Valid
 * inputs are unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReviewCoverage } from "@/lib/pipeline/runPlan";

type Issues = Parameters<typeof formatReviewCoverage>[0];
type Selected = Parameters<typeof formatReviewCoverage>[1];

const issue = (rank: number, frameIndex: number, proof: number[] = []) => ({
  rank,
  frameIndex,
  proofFrames: proof.map((f) => ({ frameIndex: f, tSec: 0 })),
});

describe("formatReviewCoverage malformed-input guard", () => {
  test("a number issues side stays quiet", () => {
    assert.equal(
      formatReviewCoverage(7 as unknown as Issues, []),
      null,
    );
  });

  test("a null selected side stays quiet", () => {
    assert.equal(
      formatReviewCoverage([issue(1, 0)], null as unknown as Selected),
      null,
    );
  });

  test("a null issue entry stays quiet", () => {
    assert.equal(
      formatReviewCoverage([null] as unknown as Issues, [0]),
      null,
    );
  });

  test("a string proofFrames side stays quiet", () => {
    assert.equal(
      formatReviewCoverage(
        [{ rank: 1, frameIndex: 0, proofFrames: "x" }] as unknown as Issues,
        [0],
      ),
      null,
    );
  });

  test("a null proof entry stays quiet", () => {
    assert.equal(
      formatReviewCoverage(
        [{ rank: 1, frameIndex: 0, proofFrames: [null] }] as unknown as Issues,
        [0],
      ),
      null,
    );
  });

  test("a valid left-out issue is still named by primary frame", () => {
    assert.equal(
      formatReviewCoverage([issue(1, 0), issue(2, 3), issue(3, 7)], [0, 3]),
      "runPlan: review: 2/3 issues have a proof photo, left out frames: 7",
    );
  });

  test("a valid covered run still stays quiet", () => {
    assert.equal(
      formatReviewCoverage([issue(1, 0), issue(2, 3)], [0, 3]),
      null,
    );
  });
});
