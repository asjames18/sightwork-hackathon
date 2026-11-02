/**
 * buildReasonPrompt rejects a segmentation counts field that is not
 * an array at all, instead of printing it verbatim as JSON: the
 * per-entry guards only run when counts is an array, so a string,
 * number, object, or null counts field used to reach the model
 * inside the SEGMENTATION section. The segment step only produces
 * a counts array ({ label, count, confidence }[]).
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

function withCounts(counts: unknown): ReasonInput {
  return {
    ...base,
    segmentation: {
      counts: counts as { label: string; count: number; confidence: number }[],
      flaggedFrames: [],
    },
  };
}

describe("buildReasonPrompt segmentation counts must be an array", () => {
  test("rejects a string counts field", () => {
    assert.throws(
      () => buildReasonPrompt(withCounts("Padded chairs")),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("rejects a number or object counts field", () => {
    assert.throws(
      () => buildReasonPrompt(withCounts(5)),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
    assert.throws(
      () => buildReasonPrompt(withCounts({ label: "Padded chairs" })),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("rejects a null counts field", () => {
    assert.throws(
      () => buildReasonPrompt(withCounts(null)),
      /buildReasonPrompt: segmentation\.counts must be an array/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(
      withCounts([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
    );
    assert.ok(prompt.includes('"count":5'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
