/**
 * formatReasonStability (offline, pure): a one-line fingerprint of the
 * SAM input and the reason output, logged by runPlan after the reason
 * step so a repeat-run swing can be traced to SAM or to the reason
 * model. It changes no plan output. No network, no model calls.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatReasonStability,
  type ReasonOutput,
  type SegmentationResult,
} from "@/lib/pipeline/reason";

function output(issues: number, watch?: number, hero = 3): Pick<ReasonOutput, "issues" | "watch" | "heroFrameIndex"> {
  return {
    issues: Array.from({ length: issues }, (_, i) => ({ rank: i + 1 })) as ReasonOutput["issues"],
    ...(watch === undefined ? {} : { watch: Array.from({ length: watch }, () => ({})) as ReasonOutput["watch"] }),
    heroFrameIndex: hero,
  };
}

const sam: SegmentationResult = {
  counts: [
    { label: "Chairs", count: 4, confidence: 0.9 },
    { label: "Exit signs", count: 1, confidence: 0.8 },
  ],
  flaggedFrames: [2, 5, 9],
};

describe("formatReasonStability", () => {
  test("names SAM flagged frames, counts, issue and watch counts, and the hero frame", () => {
    assert.equal(
      formatReasonStability(sam, output(3, 1)),
      "runPlan: reason stability: sam flagged 3 frames, counts Chairs=4, Exit signs=1; reason 3 issues, 1 watch, hero frame 3",
    );
  });

  test("a skipped segment step reads as sam skipped and a missing watch reads as 0", () => {
    assert.equal(
      formatReasonStability(null, output(1)),
      "runPlan: reason stability: sam skipped; reason 1 issues, 0 watch, hero frame 3",
    );
  });

  test("an empty count list reads as none, not an empty string", () => {
    assert.equal(
      formatReasonStability({ counts: [], flaggedFrames: [] }, output(0, 0, 0)),
      "runPlan: reason stability: sam flagged 0 frames, counts none; reason 0 issues, 0 watch, hero frame 0",
    );
  });
});
