/**
 * buildReasonPrompt rejects a bad segmentation flaggedFrames entry,
 * instead of printing it verbatim as JSON: JSON.stringify turns NaN
 * and Infinity into null, and a string token in the array is expanded
 * by the later transcript fill (segmentation_json is filled before
 * transcript), so a "{{transcript}}" entry used to print the whole
 * transcript inside the SEGMENTATION section. The segment step only
 * flags integer frame indices, so an entry is a whole number >= 0.
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

describe("buildReasonPrompt segmentation flaggedFrames", () => {
  test("rejects a NaN or Infinity flagged frame", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged([Number.NaN])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
    assert.throws(
      () => buildReasonPrompt(withFlagged([Number.POSITIVE_INFINITY])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
  });

  test("rejects a negative or fractional flagged frame", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged([-1])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
    assert.throws(
      () => buildReasonPrompt(withFlagged([2.5])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
  });

  test("rejects a non-number flagged frame, including a placeholder token", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged(["{{transcript}}"])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
    assert.throws(
      () => buildReasonPrompt(withFlagged(["3"])),
      /buildReasonPrompt: segmentation\.flaggedFrames\[0\] must be a whole number >= 0/,
    );
  });

  test("rejects a non-array flaggedFrames", () => {
    assert.throws(
      () => buildReasonPrompt(withFlagged(3)),
      /buildReasonPrompt: segmentation\.flaggedFrames must be an array/,
    );
  });

  test("still builds a clean reason prompt with flagged frames", () => {
    const prompt = buildReasonPrompt(withFlagged([0, 3]));
    assert.ok(prompt.includes('"flaggedFrames":[0,3]'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds a clean reason prompt without segmentation", () => {
    const prompt = buildReasonPrompt({ ...base, segmentation: null });
    assert.ok(prompt.includes("(no segmentation data"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
