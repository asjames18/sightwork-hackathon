/**
 * buildReasonPrompt rejects a bad segmentation count or confidence,
 * instead of printing it verbatim as JSON: JSON.stringify turns NaN
 * and Infinity into null, so a bad count used to reach the model as
 * count null. The segment step sums whole instances and averages
 * scores, so a count is a whole number >= 0 and a confidence is a
 * finite number between 0 and 1.
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

function withCount(count: unknown, confidence: unknown): ReasonInput {
  return {
    ...base,
    segmentation: {
      counts: [
        {
          label: "Padded chairs",
          count: count as number,
          confidence: confidence as number,
        },
      ],
      flaggedFrames: [],
    },
  };
}

describe("buildReasonPrompt segmentation count and confidence", () => {
  test("rejects a NaN count", () => {
    assert.throws(
      () => buildReasonPrompt(withCount(Number.NaN, 0.9)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.count must be a whole number >= 0/,
    );
  });

  test("rejects an Infinity count", () => {
    assert.throws(
      () => buildReasonPrompt(withCount(Number.POSITIVE_INFINITY, 0.9)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.count must be a whole number >= 0/,
    );
  });

  test("rejects a negative or fractional count", () => {
    assert.throws(
      () => buildReasonPrompt(withCount(-1, 0.9)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.count must be a whole number >= 0/,
    );
    assert.throws(
      () => buildReasonPrompt(withCount(2.5, 0.9)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.count must be a whole number >= 0/,
    );
  });

  test("rejects a NaN or out-of-range confidence", () => {
    assert.throws(
      () => buildReasonPrompt(withCount(5, Number.NaN)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.confidence must be a finite number between 0 and 1/,
    );
    assert.throws(
      () => buildReasonPrompt(withCount(5, 1.2)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.confidence must be a finite number between 0 and 1/,
    );
    assert.throws(
      () => buildReasonPrompt(withCount(5, -0.1)),
      /buildReasonPrompt: segmentation\.counts\[0\]\.confidence must be a finite number between 0 and 1/,
    );
  });

  test("still builds a clean reason prompt with boundary values", () => {
    const prompt = buildReasonPrompt(withCount(0, 0));
    assert.ok(prompt.includes('"count":0'));
    assert.ok(prompt.includes('"confidence":0'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds a clean reason prompt without segmentation", () => {
    const prompt = buildReasonPrompt({ ...base, segmentation: null });
    assert.ok(prompt.includes("(no segmentation data"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
