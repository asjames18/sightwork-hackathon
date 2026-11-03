/** formatReasonStability heroFrameIndex guard: a non-whole hero frame
 * printed straight into the stability line ("hero frame NaN",
 * "hero frame 2.5") with no error named — and that line is what a
 * repeat-run swing is diagnosed from. Such values now throw a named
 * reason error. Valid inputs are unchanged: a whole frame index still
 * renders the same line. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatReasonStability,
  type ReasonOutput,
  type SegmentationResult,
} from "@/lib/pipeline/reason";

const sam: SegmentationResult = {
  counts: [{ label: "Chairs", count: 4, confidence: 0.9 }],
  flaggedFrames: [2, 5, 9],
};

const outputWith = (heroFrameIndex: unknown): Pick<ReasonOutput, "issues" | "watch" | "heroFrameIndex"> =>
  ({ issues: [], heroFrameIndex }) as unknown as Pick<
    ReasonOutput,
    "issues" | "watch" | "heroFrameIndex"
  >;

describe("formatReasonStability heroFrameIndex guard", () => {
  test("a NaN heroFrameIndex throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability(sam, outputWith(Number.NaN)),
      /reason: formatReasonStability output\.heroFrameIndex must be a whole-number frame index >= 0/,
    );
  });

  test("a fractional heroFrameIndex throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability(sam, outputWith(2.5)),
      /reason: formatReasonStability output\.heroFrameIndex must be a whole-number frame index >= 0/,
    );
  });

  test("a negative heroFrameIndex throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability(sam, outputWith(-1)),
      /reason: formatReasonStability output\.heroFrameIndex must be a whole-number frame index >= 0/,
    );
  });

  test("a non-number heroFrameIndex throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability(sam, outputWith("3")),
      /reason: formatReasonStability output\.heroFrameIndex must be a whole-number frame index >= 0/,
    );
  });

  test("a whole heroFrameIndex still renders the same stability line", () => {
    assert.equal(
      formatReasonStability(
        sam,
        { issues: [{ rank: 1 }, { rank: 2 }, { rank: 3 }] as ReasonOutput["issues"], watch: [{}] as ReasonOutput["watch"], heroFrameIndex: 3 },
      ),
      "runPlan: reason stability: sam flagged 3 frames, counts Chairs=4; reason 3 issues, 1 watch, hero frame 3",
    );
  });
});
