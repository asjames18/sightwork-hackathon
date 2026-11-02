/**
 * buildReasonPrompt rejects a segmentation counts entry that is an
 * array at all, instead of printing it as an empty array: arrays are
 * objects in JavaScript, and the per-field guards read label, count
 * and confidence straight off the array, so an entry carrying those
 * fields as array properties passed every check — but JSON.stringify
 * drops array properties, so it used to reach the model as "[]" and
 * its count was silently lost. The segment step only produces plain
 * count objects ({ label, count, confidence }).
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

function withSegmentation(segmentation: unknown): ReasonInput {
  return {
    ...base,
    segmentation: segmentation as ReasonInput["segmentation"],
  };
}

describe("buildReasonPrompt segmentation counts entry must be an object, not an array", () => {
  test("rejects an array entry carrying label, count and confidence as properties", () => {
    const entry: unknown = Object.assign([], {
      label: "Padded chairs",
      count: 5,
      confidence: 0.9,
    });
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({ counts: [entry], flaggedFrames: [] }),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\] must be an object, not an array/,
    );
  });

  test("rejects a plain array counts entry", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withSegmentation({ counts: [["Padded chairs", 5, 0.9]], flaggedFrames: [] }),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\] must be an object, not an array/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(
      withSegmentation({
        counts: [{ label: "Padded chairs", count: 5, confidence: 0.9 }],
        flaggedFrames: [],
      }),
    );
    assert.ok(prompt.includes('"count":5'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("a null segmentation still builds the no-data prompt", () => {
    const prompt = buildReasonPrompt(withSegmentation(null));
    assert.ok(prompt.includes("(no segmentation data"));
  });
});
