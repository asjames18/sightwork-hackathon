/**
 * buildReasonPrompt rejects a segmentation counts label that is
 * empty or only whitespace, instead of printing it verbatim as
 * JSON: a count row with no item name ("label":"") cannot be
 * attached to an inventory item, and the model could silently
 * drop or misassign the count. A whitespace-only label fails
 * the same way, on the trimmed label; the uniqueness check
 * already normalizes case and whitespace. Distinct labels and
 * a single label still build.
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

describe("buildReasonPrompt segmentation empty counts label", () => {
  test("rejects an empty label at index 0", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([{ label: "", count: 5, confidence: 0.9 }]),
        ),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must not be empty/,
    );
  });

  test("rejects a whitespace-only label at index 1", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "   ", count: 3, confidence: 0.8 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\]\.label must not be empty/,
    );
  });

  test("rejects an empty label at a later index, naming that index", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            { label: "Choir chairs", count: 2, confidence: 0.8 },
            { label: "", count: 1, confidence: 0.7 },
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[2\]\.label must not be empty/,
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
