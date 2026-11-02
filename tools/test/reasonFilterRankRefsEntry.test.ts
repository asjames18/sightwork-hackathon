/** filterAndRenumber rank-reference guard: materials forIssues and
 * workOrder fixes are remapped below with .filter/.map, so a
 * non-array reference used to throw a raw TypeError, and a
 * non-number rank inside one was silently dropped by the remap
 * lookup, with no entry named. Such inputs now throw a named
 * reason error naming the field and index. Valid outputs are
 * unchanged: rank references still remap to kept ranks only.
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

describe("filterAndRenumber rank-reference guard", () => {
  test("a non-array forIssues throws a named reason error", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          materials: [{ item: "tape", qty: "1 roll", forIssues: "1" }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.materials\[0\]\.forIssues must be an array/,
    );
  });

  test("a non-number forIssues entry throws a named reason error with the index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          materials: [{ item: "tape", qty: "1 roll", forIssues: [1, "2"] }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.materials\[0\]\.forIssues\[1\] must be a finite number/,
    );
  });

  test("a non-array fixes throws a named reason error", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          workOrder: [{ order: 1, title: "tape it", detail: "tape the cable", fixes: 1 }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.workOrder\[0\]\.fixes must be an array/,
    );
  });

  test("a non-number fixes entry throws a named reason error with the index", () => {
    assert.throws(
      () =>
        filterAndRenumber({
          ...output,
          workOrder: [{ order: 1, title: "tape it", detail: "tape the cable", fixes: [null] }],
        } as unknown as ReasonOutput),
      /reason: filterAndRenumber output\.workOrder\[0\]\.fixes\[0\] must be a finite number/,
    );
  });

  test("valid rank references still remap to kept ranks only", () => {
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
      materials: [{ item: "tape", qty: "1 roll", forIssues: [1, 2] }],
      workOrder: [{ order: 1, title: "tape it", detail: "tape the cable", fixes: [1, 2] }],
    });
    assert.deepEqual(result.materials[0].forIssues, [1]);
    assert.deepEqual(result.workOrder[0].fixes, [1]);
    assert.equal(result.issues.length, 1);
    assert.equal(result.watch?.length, 1);
  });
});
