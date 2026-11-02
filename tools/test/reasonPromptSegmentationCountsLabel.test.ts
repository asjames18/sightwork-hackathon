/**
 * buildReasonPrompt rejects a segmentation counts entry whose label
 * is not a string at all, instead of printing it verbatim as JSON:
 * the placeholder guard only runs when the label is a string, so a
 * number label used to reach the model as "label":5 and a missing
 * label was dropped from the JSON entirely. The segment step only
 * produces count objects ({ label, count, confidence }) with a
 * string label.
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

describe("buildReasonPrompt segmentation counts label must be a string", () => {
  test("rejects a number or object label", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([{ label: 5, count: 5, confidence: 0.9 }]),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must be a string/,
    );
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([{ label: { text: "chairs" }, count: 5, confidence: 0.9 }]),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must be a string/,
    );
  });

  test("rejects a null or missing label", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([{ label: null, count: 5, confidence: 0.9 }]),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must be a string/,
    );
    assert.throws(
      () => buildReasonPrompt(withCounts([{ count: 5, confidence: 0.9 }])),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must be a string/,
    );
  });

  test("names a non-string label at a later index", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: 7, count: 2, confidence: 0.8 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\]\.label must be a string/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(
      withCounts([{ label: "Padded chairs", count: 5, confidence: 0.9 }]),
    );
    assert.ok(prompt.includes('"label":"Padded chairs"'));
    assert.ok(prompt.includes('"count":5'));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
