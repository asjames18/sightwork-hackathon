/** filterAndRenumber unmentioned guard: the keep bar reads unmentioned
 * only for truthiness, so a non-boolean value used to silently pick
 * the wrong bar — the string "false" is truthy and raised it to 0.6,
 * dropping an issue that should have stayed ranked, with no entry
 * named. Such inputs now throw a named reason error naming the issue
 * index. Valid issues are unchanged: a boolean unmentioned still
 * picks its bar, and a kept issue stays ranked while a demoted one
 * moves to watch. No network. */
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

describe("filterAndRenumber unmentioned guard", () => {
  test("a string unmentioned throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [{ ...issue(), unmentioned: "false" }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[0\]\.unmentioned must be a boolean/,
    );
  });

  test("a numeric unmentioned throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [issue(), { ...issue(), unmentioned: 1 }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[1\]\.unmentioned must be a boolean/,
    );
  });

  test("a boolean unmentioned still picks the right bar", () => {
    const result = filterAndRenumber({
      ...output,
      issues: [
        issue({ rank: 1, confidence: 0.55, unmentioned: false }),
        issue({ rank: 2, confidence: 0.55, unmentioned: true }),
      ],
    });
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].rank, 1);
    assert.equal(result.watch?.length, 1);
  });
});
