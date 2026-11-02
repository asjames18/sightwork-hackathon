/** filterAndRenumber issues-confidence guard: issues are kept,
 * watched, or dropped below by confidence, so a non-number
 * confidence used to be silently mishandled — NaN falls through
 * every bar and drops the issue with no entry named, null fell to
 * 0 and dropped the same way, and a string coerced through the
 * comparison. Such inputs now throw a named reason error naming
 * the issue index. Valid issues are unchanged: a kept confidence
 * remaps, a watch confidence moves to watch, a low confidence
 * drops, and an undefined confidence still defaults to 0 and
 * drops. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterAndRenumber,
  type ReasonOutput,
} from "@/lib/pipeline/reason";
import type { Issue } from "@/lib/types";

const issue = (over: Partial<Issue> = {}): Issue => ({
  rank: 1,
  title: "cable",
  detail: "cable on floor",
  severity: "high",
  frameIndex: 0,
  frameTimeSec: 0,
  confidence: 0.9,
  unmentioned: false,
  ...over,
});

const output: ReasonOutput = {
  spaceName: "stage",
  generatedFrom: "walkthrough",
  inventory: [],
  issues: [issue()],
  materials: [],
  workOrder: [],
  transcriptSummary: null,
  saidVsSeen: [],
  heroFrameIndex: 0,
};

describe("filterAndRenumber issues-confidence guard", () => {
  test("a non-number confidence throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [{ ...issue(), confidence: "0.9" }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[0\]\.confidence must be a finite number/,
    );
  });

  test("a non-finite confidence throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [issue(), { ...issue(), rank: 2, confidence: Number.NaN }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[1\]\.confidence must be a finite number/,
    );
  });

  test("a null confidence throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [{ ...issue(), confidence: null }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[0\]\.confidence must be a finite number/,
    );
  });

  test("valid confidences still keep, watch, or drop, and undefined still drops", () => {
    const noConfidence = issue({
      rank: 4,
      title: "dust",
      detail: "dust on shelf",
      severity: "low",
    });
    delete noConfidence.confidence;
    const result = filterAndRenumber({
      ...output,
      issues: [
        issue(),
        issue({ rank: 2, title: "loose chair", detail: "chair wobbles", severity: "low", confidence: 0.4 }),
        issue({ rank: 3, title: "scuff", detail: "scuff on wall", severity: "low", confidence: 0.2 }),
        noConfidence,
      ],
    });
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].rank, 1);
    assert.equal(result.watch?.length, 1);
    assert.equal(result.watch?.[0].title, "loose chair");
  });
});
