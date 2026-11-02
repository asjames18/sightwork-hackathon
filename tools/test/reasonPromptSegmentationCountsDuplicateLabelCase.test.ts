/**
 * buildReasonPrompt rejects a segmentation counts label repeated
 * apart from case or surrounding whitespace, instead of printing
 * it verbatim as JSON: "Padded chairs" and "padded chairs" are
 * the same item counted twice, and the model could add the two
 * rows together, overstating the inventory. The exact-string set
 * used to let a case variant through; the cost prompt already
 * treats a material item as the same when trimmed and lowercased,
 * and the reason prompt now matches. Distinct labels still build.
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

describe("buildReasonPrompt segmentation duplicate counts label case", () => {
  test("rejects a label repeated apart from case at index 1", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "padded chairs", count: 3, confidence: 0.8 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\]\.label must be unique/,
    );
  });

  test("rejects a label repeated apart from case at a later index, naming that index", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "Choir chairs", count: 2, confidence: 0.8 },
            { label: "CHOIR CHAIRS", count: 1, confidence: 0.7 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[2\]\.label must be unique/,
    );
  });

  test("rejects a label repeated apart from surrounding whitespace at index 1", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "Padded chairs ", count: 3, confidence: 0.8 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\]\.label must be unique/,
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
