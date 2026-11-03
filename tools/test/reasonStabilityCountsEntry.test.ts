/** formatReasonStability counts guard: a counts entry was only checked
 * to be an object, so a non-string label or a non-whole count printed
 * straight into the stability line ("2.5 chairs", "NaN") with no entry
 * named — and that line is what a repeat-run swing is diagnosed from.
 * Such entries now throw a named reason error naming the counts index.
 * Valid inputs are unchanged: a good label/count pair still renders
 * the same line. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatReasonStability,
  type ReasonOutput,
  type SegmentationResult,
} from "@/lib/pipeline/reason";

const output: Pick<ReasonOutput, "issues" | "watch" | "heroFrameIndex"> = {
  issues: [],
  heroFrameIndex: 0,
};

const sam = (counts: unknown): SegmentationResult =>
  ({ counts, flaggedFrames: [2] }) as unknown as SegmentationResult;

describe("formatReasonStability counts guard", () => {
  test("a non-string counts label throws a named reason error with the index", () => {
    assert.throws(
      () =>
        formatReasonStability(
          sam([
            { label: "Chairs", count: 4, confidence: 0.9 },
            { label: 7, count: 1, confidence: 0.8 },
          ]),
          output,
        ),
      /reason: formatReasonStability segmentation\.counts\[1\] must have a non-empty string label and a whole-number count >= 0/,
    );
  });

  test("a fractional counts count throws a named reason error with the index", () => {
    assert.throws(
      () =>
        formatReasonStability(
          sam([{ label: "Chairs", count: 2.5, confidence: 0.9 }]),
          output,
        ),
      /reason: formatReasonStability segmentation\.counts\[0\] must have a non-empty string label and a whole-number count >= 0/,
    );
  });

  test("a NaN counts count throws a named reason error with the index", () => {
    assert.throws(
      () =>
        formatReasonStability(
          sam([{ label: "Chairs", count: Number.NaN, confidence: 0.9 }]),
          output,
        ),
      /reason: formatReasonStability segmentation\.counts\[0\] must have a non-empty string label and a whole-number count >= 0/,
    );
  });

  test("valid counts still render the same stability line", () => {
    assert.equal(
      formatReasonStability(
        {
          counts: [
            { label: "Chairs", count: 4, confidence: 0.9 },
            { label: "Exit signs", count: 1, confidence: 0.8 },
          ],
          flaggedFrames: [2, 5, 9],
        },
        { issues: [{ rank: 1 }, { rank: 2 }, { rank: 3 }] as ReasonOutput["issues"], watch: [{}] as ReasonOutput["watch"], heroFrameIndex: 3 },
      ),
      "runPlan: reason stability: sam flagged 3 frames, counts Chairs=4, Exit signs=1; reason 3 issues, 1 watch, hero frame 3",
    );
  });
});
