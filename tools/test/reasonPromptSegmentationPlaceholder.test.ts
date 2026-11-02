/**
 * buildReasonPrompt rejects a {{placeholder}} token in a segmentation
 * count label, instead of letting the transcript fill expand it:
 * fills run in order (space_type, space_checklist, space_name,
 * duration_sec, frame_count, frame_list, segmentation_json,
 * transcript), so a {{transcript}} token in a label used to print
 * the whole transcript inside the SEGMENTATION section. Other
 * tokens in a label are caught by the final unfilled-placeholder
 * check, but the validator rejects any token here so the failure
 * names the field.
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

function withLabel(label: string): ReasonInput {
  return {
    ...base,
    segmentation: {
      counts: [{ label, count: 5, confidence: 0.9 }],
      flaggedFrames: [],
    },
  };
}

describe("buildReasonPrompt {{placeholder}} in a segmentation count label", () => {
  test("rejects a {{transcript}} token in the label", () => {
    assert.throws(
      () => buildReasonPrompt(withLabel("Chairs {{transcript}}")),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{space_name}} token in the label", () => {
    assert.throws(
      () => buildReasonPrompt(withLabel("Chairs {{space_name}}")),
      /buildReasonPrompt: segmentation\.counts\[0\]\.label must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("still builds a clean reason prompt with segmentation", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes("Padded chairs"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds a clean reason prompt without segmentation", () => {
    const prompt = buildReasonPrompt({ ...base, segmentation: null });
    assert.ok(prompt.includes("(no segmentation data"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
