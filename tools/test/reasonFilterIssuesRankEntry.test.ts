/** filterAndRenumber issues-rank guard: issues are renumbered below
 * through a remap keyed on rank, so a non-number rank used to
 * silently break every rank reference to that issue — a string key
 * never matches a numeric forIssues/fixes entry, so the reference
 * was dropped by the remap lookup with no entry named, while the
 * kept issue itself was renumbered anyway. Such inputs now throw a
 * named reason error naming the issue index. Valid issues are
 * unchanged: kept ranks renumber and materials references remap
 * through the new ranks. No network. */
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

describe("filterAndRenumber issues-rank guard", () => {
  test("a non-number rank throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [{ ...issue(), rank: "1" }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[0\]\.rank must be a finite number/,
    );
  });

  test("a non-finite rank throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [issue(), { ...issue(), rank: Number.NaN }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[1\]\.rank must be a finite number/,
    );
  });

  test("a null rank throws a named reason error with the issue index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          issues: [{ ...issue(), rank: null }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.issues\[0\]\.rank must be a finite number/,
    );
  });

  test("valid ranks still renumber and remap materials references", () => {
    const result = filterAndRenumber({
      ...output,
      issues: [
        issue({ rank: 5 }),
        issue({ rank: 9, title: "loose chair", detail: "chair wobbles", severity: "low" }),
      ],
      materials: [
        {
          item: "tape",
          qty: "1 roll",
          forIssues: [9, 5],
        },
      ],
    });
    assert.equal(result.issues.length, 2);
    assert.equal(result.issues[0].rank, 1);
    assert.equal(result.issues[1].rank, 2);
    assert.deepEqual(result.materials[0].forIssues, [2, 1]);
  });
});
