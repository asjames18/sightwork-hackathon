/** formatReasonStability / formatReasonFilter entry guards: a
 * non-object segmentation, a non-array flaggedFrames/counts, a null
 * counts entry, or a non-object side / non-array issues list used to
 * throw a raw TypeError reading .length / .map / .label / .issues off
 * null, with no argument named — and a string issues list silently
 * produced a nonsense line (a negative drop count). Such inputs now
 * throw a named reason error naming the argument and field. Valid
 * inputs are unchanged: the stability and filter lines read exactly
 * the same fields. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatReasonFilter,
  formatReasonStability,
  type SegmentationResult,
} from "@/lib/pipeline/reason";

const seg: SegmentationResult = {
  counts: [{ label: "door", count: 2, confidence: 0.9 }],
  flaggedFrames: [3],
};
// Only lengths are read, so bare placeholder entries stand in for full issues.
const out = { issues: [{}, {}], watch: [{}], heroFrameIndex: 3 } as never;

describe("formatReasonStability entry guard", () => {
  test("a non-object segmentation throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability("x" as unknown as SegmentationResult, out),
      /reason: formatReasonStability segmentation must be an object or null/,
    );
  });

  test("non-array flaggedFrames or counts throw a named reason error", () => {
    assert.throws(
      () => formatReasonStability({ counts: [], flaggedFrames: null } as unknown as SegmentationResult, out),
      /reason: formatReasonStability segmentation\.flaggedFrames must be an array/,
    );
    assert.throws(
      () => formatReasonStability({ counts: null, flaggedFrames: [] } as unknown as SegmentationResult, out),
      /reason: formatReasonStability segmentation\.counts must be an array/,
    );
  });

  test("a non-object counts entry throws a named reason error with the index", () => {
    assert.throws(
      () => formatReasonStability({ counts: [null], flaggedFrames: [] } as unknown as SegmentationResult, out),
      /reason: formatReasonStability segmentation\.counts\[0\] must be an object/,
    );
  });

  test("a non-object output or non-array issues/watch throws a named reason error", () => {
    assert.throws(
      () => formatReasonStability(seg, null as unknown as typeof out),
      /reason: formatReasonStability output must be an object/,
    );
    assert.throws(
      () => formatReasonStability(seg, { issues: null, heroFrameIndex: 0 } as unknown as typeof out),
      /reason: formatReasonStability output\.issues must be an array/,
    );
    assert.throws(
      () => formatReasonStability(seg, { issues: [], watch: "x", heroFrameIndex: 0 } as unknown as typeof out),
      /reason: formatReasonStability output\.watch must be an array/,
    );
  });

  test("valid inputs still produce the same stability lines", () => {
    assert.equal(
      formatReasonStability(seg, out),
      "runPlan: reason stability: sam flagged 1 frames, counts door=2; reason 2 issues, 1 watch, hero frame 3",
    );
    assert.equal(
      formatReasonStability(null, out),
      "runPlan: reason stability: sam skipped; reason 2 issues, 1 watch, hero frame 3",
    );
  });
});

describe("formatReasonFilter entry guard", () => {
  test("a non-object side throws a named reason error", () => {
    assert.throws(
      () => formatReasonFilter(null as unknown as typeof out, { issues: [] }),
      /reason: formatReasonFilter raw must be an object/,
    );
    assert.throws(
      () => formatReasonFilter({ issues: [] }, null as unknown as typeof out),
      /reason: formatReasonFilter filtered must be an object/,
    );
  });

  test("a non-array issues list throws a named reason error instead of a nonsense line", () => {
    assert.throws(
      () => formatReasonFilter({ issues: [] }, { issues: "x" } as unknown as typeof out),
      /reason: formatReasonFilter filtered\.issues must be an array/,
    );
  });

  test("a non-array watch list throws a named reason error", () => {
    assert.throws(
      () => formatReasonFilter({ issues: [], watch: 3 } as unknown as typeof out, { issues: [] }),
      /reason: formatReasonFilter raw\.watch must be an array/,
    );
  });

  test("a valid filter still produces the same summary line", () => {
    assert.equal(
      formatReasonFilter(
        { issues: [{}, {}, {}, {}, {}], watch: [{}] } as never,
        { issues: [{}, {}], watch: [{}, {}] } as never,
      ),
      "reason: filter kept 2 ranked, 2 watch (1 from model, 1 demoted), dropped 2 of 5 raw issues",
    );
  });
});
