/** filterAndRenumber saidVsSeen-rank guard: saidVsSeen rows are
 * filtered below by the remap lookup, so a non-number issueRank
 * used to be silently dropped as an unkept rank, with no entry
 * named. Such inputs now throw a named reason error naming the
 * row index. Valid rows are unchanged: a kept rank remaps, a
 * dropped rank's row is dropped, and an undefined rank stays.
 * No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterAndRenumber,
  type ReasonOutput,
} from "@/lib/pipeline/reason";

const issue = {
  rank: 1,
  title: "cable",
  detail: "cable on floor",
  severity: "high" as const,
  frameIndex: 0,
  frameTimeSec: 0,
  confidence: 0.9,
  unmentioned: false,
};

const row = (issueRank?: unknown) => ({
  status: "mentioned" as const,
  said: { quote: "cable", atSec: 0 },
  seen: { summary: "cable on floor", frameIndex: 0 },
  ...(issueRank === undefined ? {} : { issueRank }),
});

const output: ReasonOutput = {
  spaceName: "stage",
  generatedFrom: "walkthrough",
  inventory: [],
  issues: [issue],
  materials: [],
  workOrder: [],
  transcriptSummary: null,
  saidVsSeen: [],
  heroFrameIndex: 0,
};

describe("filterAndRenumber saidVsSeen-rank guard", () => {
  test("a non-number issueRank throws a named reason error with the row index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          saidVsSeen: [row("1")],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.saidVsSeen\[0\]\.issueRank must be a finite number/,
    );
  });

  test("a non-finite issueRank throws a named reason error with the row index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          saidVsSeen: [row(1), row(Number.NaN)],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.saidVsSeen\[1\]\.issueRank must be a finite number/,
    );
  });

  test("valid saidVsSeen ranks still remap, drop, or stay", () => {
    const demoted = {
      rank: 2,
      title: "loose chair",
      detail: "chair wobbles",
      severity: "low" as const,
      frameIndex: 0,
      frameTimeSec: 0,
      confidence: 0.4,
      unmentioned: false,
    };
    const result = filterAndRenumber({
      ...output,
      issues: [issue, demoted],
      // Typed view of the helper rows (type-only; no runtime change).
      saidVsSeen: [row(1), row(2), row()] as ReasonOutput["saidVsSeen"],
    });
    assert.equal(result.saidVsSeen.length, 2);
    assert.equal(result.saidVsSeen[0].issueRank, 1);
    assert.equal(result.saidVsSeen[1].issueRank, undefined);
    assert.equal(result.issues.length, 1);
  });
});
