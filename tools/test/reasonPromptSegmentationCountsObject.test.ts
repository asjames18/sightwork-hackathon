/**
 * buildReasonPrompt rejects a segmentation counts entry that is not
 * an object at all, instead of printing it verbatim as JSON: the
 * per-field guards only check label/count/confidence when the entry
 * is an object, so a null, string, or number entry used to reach the
 * model inside the SEGMENTATION section. The segment step only
 * produces count objects ({ label, count, confidence }).
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

describe("buildReasonPrompt segmentation counts entry must be an object", () => {
  test("rejects a null entry", () => {
    assert.throws(
      () => buildReasonPrompt(withCounts([null])),
      /buildReasonPrompt: segmentation\.counts\[0\] must be an object/,
    );
  });

  test("rejects a string or number entry", () => {
    assert.throws(
      () => buildReasonPrompt(withCounts(["Padded chairs"])),
      /buildReasonPrompt: segmentation\.counts\[0\] must be an object/,
    );
    assert.throws(
      () => buildReasonPrompt(withCounts([5])),
      /buildReasonPrompt: segmentation\.counts\[0\] must be an object/,
    );
  });

  test("rejects an undefined entry at a later index", () => {
    assert.throws(
      () =>
        buildReasonPrompt(
          withCounts([
            { label: "Padded chairs", count: 5, confidence: 0.9 },
            undefined,
          ]),
        ),
      /buildReasonPrompt: segmentation\.counts\[1\] must be an object/,
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
