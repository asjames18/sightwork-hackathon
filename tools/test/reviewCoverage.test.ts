/**
 * formatReviewCoverage (server log only, reviewing step): reports how many issues have a selected
 * proof photo for the reviewer, and names the primary frame of any issue left without one, so a real
 * run shows whether the 8-photo review cap left an issue unseen. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReviewCoverage } from "@/lib/pipeline/runPlan";

const issue = (rank: number, frameIndex: number, proof: number[] = []) => ({
  rank,
  frameIndex,
  proofFrames: proof.map((f) => ({ frameIndex: f, tSec: 0 })),
});

describe("formatReviewCoverage", () => {
  test("all issues covered stays quiet", () => {
    assert.equal(
      formatReviewCoverage([issue(1, 0), issue(2, 3)], [0, 3]),
      null,
    );
  });

  test("issues left out are named by primary frame", () => {
    assert.equal(
      formatReviewCoverage([issue(1, 0), issue(2, 3), issue(3, 7)], [0, 3]),
      "runPlan: review: 2/3 issues have a proof photo, left out frames: 7",
    );
  });

  test("covered through a proof frame, not the primary, stays quiet", () => {
    assert.equal(formatReviewCoverage([issue(1, 0, [5])], [5]), null);
  });

  test("no issues stays quiet", () => {
    assert.equal(formatReviewCoverage([], []), null);
  });

  test("issues with no usable frame are ignored and left-out frames sort", () => {
    assert.equal(
      formatReviewCoverage(
        [issue(1, 9), issue(2, 3), issue(3, 9), { rank: 4, frameIndex: -1, proofFrames: [] }],
        [0],
      ),
      "runPlan: review: 0/3 issues have a proof photo, left out frames: 3, 9",
    );
  });

  test("duplicate selected frames count once", () => {
    assert.equal(formatReviewCoverage([issue(1, 2)], [2, 2]), null);
  });
});
