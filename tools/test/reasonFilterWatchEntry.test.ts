/** filterAndRenumber watch entry guard: the passed-through watch list
 * used to spread a string into single characters, or pass a null
 * entry through silently, with no entry named. Such inputs now throw
 * a named reason error naming the field and index. Valid outputs are
 * unchanged: a watch list passes through, and no watch stays omitted.
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

describe("filterAndRenumber watch entry guard", () => {
  test("a non-array watch throws a named reason error", () => {
    assert.throws(
      () => filterAndRenumber({ ...output, watch: "x" } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.watch must be an array/,
    );
  });

  test("a non-object watch entry throws a named reason error with the index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          watch: [{ title: "low", detail: "d", frameIndex: 0, frameTimeSec: 0 }, null],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.watch\[1\] must be an object/,
    );
  });

  test("valid watch lists pass through and no watch stays omitted", () => {
    const withWatch = filterAndRenumber({
      ...output,
      watch: [{ title: "low", detail: "d", frameIndex: 0, frameTimeSec: 0, confidence: 0.4 }],
    });
    assert.equal(withWatch.issues.length, 1);
    assert.equal(withWatch.issues[0].rank, 1);
    assert.equal(withWatch.watch?.length, 1);
    assert.equal(withWatch.watch?.[0].title, "low");
    assert.equal(filterAndRenumber(output).watch, undefined);
  });
});
