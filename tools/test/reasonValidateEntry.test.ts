/** validateReason entry guard: a non-object input/output, a non-array
 * input.frames or output.issues/watch, a non-object issue/watch entry,
 * or a non-array proofFrames list used to throw a raw TypeError
 * reading .forEach / .frameIndex / .tSec off null, with no argument
 * named. Such inputs now throw a named reason error naming the
 * argument, field, and index. Valid inputs are unchanged: frame
 * mismatches still return error strings rather than throwing. No
 * network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateReason,
  type ReasonInput,
  type ReasonOutput,
} from "@/lib/pipeline/reason";

const input: ReasonInput = {
  frames: [
    { tSec: 0, dataUrl: "data:image/jpeg;base64,/9j/" },
    { tSec: 5, dataUrl: "data:image/jpeg;base64,/9j/" },
  ],
  segmentation: null,
  transcript: null,
  durationSec: 10,
};

const issue = {
  rank: 1,
  title: "cable",
  detail: "cable on floor",
  severity: "high" as const,
  frameIndex: 0,
  frameTimeSec: 0,
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
  heroFrameIndex: 1,
};

describe("validateReason entry guard", () => {
  test("a non-object input or non-array frames throws a named reason error", () => {
    assert.throws(
      () => validateReason(null as unknown as ReasonInput, output),
      /reason: validateReason input must be an object/,
    );
    assert.throws(
      () => validateReason({ ...input, frames: null } as unknown as ReasonInput, output),
      /reason: validateReason input\.frames must be an array/,
    );
  });

  test("a non-object output or non-array issues/watch throws a named reason error", () => {
    assert.throws(
      () => validateReason(input, null as unknown as ReasonOutput),
      /reason: validateReason output must be an object/,
    );
    assert.throws(
      () => validateReason(input, { ...output, issues: null } as unknown as ReasonOutput),
      /reason: validateReason output\.issues must be an array/,
    );
    assert.throws(
      () => validateReason(input, { ...output, watch: "x" } as unknown as ReasonOutput),
      /reason: validateReason output\.watch must be an array/,
    );
  });

  test("a non-object issue or watch entry throws a named reason error with the index", () => {
    assert.throws(
      () => validateReason(input, { ...output, issues: [issue, null] } as unknown as ReasonOutput),
      /reason: validateReason output\.issues\[1\] must be an object/,
    );
    assert.throws(
      () => validateReason(input, { ...output, watch: [null] } as unknown as ReasonOutput),
      /reason: validateReason output\.watch\[0\] must be an object/,
    );
  });

  test("a non-array proofFrames list or non-object proof frame throws a named reason error", () => {
    assert.throws(
      () => validateReason(input, { ...output, issues: [{ ...issue, proofFrames: "x" }] } as unknown as ReasonOutput),
      /reason: validateReason output\.issues\[0\]\.proofFrames must be an array/,
    );
    assert.throws(
      () => validateReason(input, { ...output, issues: [{ ...issue, proofFrames: [{ frameIndex: 0, tSec: 0 }, null] }] } as unknown as ReasonOutput),
      /reason: validateReason output\.issues\[0\]\.proofFrames\[1\] must be an object/,
    );
  });

  test("valid inputs still return frame errors as strings, not throws", () => {
    const errs = validateReason(input, output);
    assert.equal(errs.filter((e) => /^(issues\[|watch\[|heroFrameIndex)/.test(e)).length, 0);
    const mismatch = validateReason(input, {
      ...output,
      issues: [{ ...issue, frameTimeSec: 9 }],
    });
    assert.ok(mismatch.some((e) => e === "issues[0].frameTimeSec 9 does not match frames[0].tSec 0"));
  });
});
