/**
 * buildReasonPrompt rejects a repeated segmentation flagged frame,
 * instead of printing it verbatim as JSON: the model was told twice
 * to look hardest at the same frame. The segment step only flags
 * each frame once (a sorted, unique set), so a repeat is not a
 * frame the segment step can produce. Distinct flagged frames
 * still build, including the existing flagged-frames test's
 * out-of-range index, which is not range-checked here.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReasonPrompt } from "@/lib/pipeline/planPrompts";
import type { ReasonInput } from "@/lib/pipeline/reason";

const base: ReasonInput = {
  frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,xxxx" }],
  segmentation: {
    counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
    flaggedFrames: [],
  },
  transcript: "Hello transcript.",
  spaceName: "Sanctuary",
  spaceType: "church sanctuary",
  durationSec: 60,
};

function withFlagged(flagged: unknown): ReasonInput {
  return {
    ...base,
    segmentation: {
      counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
      flaggedFrames: flagged as number[],
    },
  };
}

describe("buildReasonPrompt segmentation duplicate flagged frame", () => {
  test("rejects a frame repeated at index 1", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged([0, 0])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[1\] must be unique/,
    );
  });

  test("rejects a frame repeated at a later index, naming that index", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged([0, 3, 3])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[2\] must be unique/,
    );
  });

  test("still builds with distinct flagged frames", () => {
    const prompt = buildReasonPrompt(withFlagged([0, 3]));
    assert.ok(prompt.includes('"flaggedFrames":[0,3]'));
  });

  test("still builds a clean prompt with one flagged frame", () => {
    const prompt = buildReasonPrompt(withFlagged([0]));
    assert.ok(prompt.includes('"flaggedFrames":[0]'));
  });
});
