/**
 * buildReasonPrompt rejects a repeated segmentation counts label,
 * instead of printing it verbatim as JSON: the same item counted
 * twice could be added together by the model, overstating the
 * inventory. Two different labels still build, and a clean prompt
 * with one label is unchanged.
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

describe("buildReasonPrompt segmentation duplicate counts label", () => {
  test("rejects a label repeated at index 1", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "Padded chairs", count: 3, confidence: 0.8 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\]\.label must be unique/,
    );
  });

  test("rejects a label repeated at a later index, naming that index", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "Choir chairs", count: 2, confidence: 0.8 },
            { label: "Choir chairs", count: 1, confidence: 0.7 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[2\]\.label must be unique/,
    );
  });

  test("still builds with distinct labels", () => {
    const prompt = buildReasonPrompt(
      withCounts([
        { label: "Padded chairs", count: 5, confidence: 0.9 },
        { label: "Choir chairs", count: 2, confidence: 0.8 },
      ]),
    );
    assert.ok(prompt.includes('"label":"Padded chairs"'));
    assert.ok(prompt.includes('"label":"Choir chairs"'));
  });

  test("still builds a clean prompt with one label", () => {
    const prompt = buildReasonPrompt(
      withCounts([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
    );
    assert.ok(prompt.includes('"label":"Padded chairs"'));
  });
});
