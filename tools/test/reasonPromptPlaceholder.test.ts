/**
 * buildReasonPrompt rejects a {{placeholder}} token in the space name
 * or the space type, instead of letting a later fill() pass expand it:
 * fills run in order (space_type, space_checklist, space_name,
 * duration_sec, frame_count, frame_list, segmentation_json,
 * transcript), so a {{transcript}} token in the space name used to
 * print the whole transcript inside the quoted name, and a
 * {{space_name}} token in the space type used to print the space
 * name there. The transcript itself is filled last, so a token in
 * it is caught by the final unfilled-placeholder check instead.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReasonPrompt } from "@/lib/pipeline/planPrompts";
import type { ReasonInput } from "@/lib/pipeline/reason";

const base: ReasonInput = {
  frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,xxxx" }],
  segmentation: null,
  transcript: "Hello transcript.",
  spaceName: "Sanctuary",
  spaceType: "church sanctuary",
  durationSec: 60,
};

describe("buildReasonPrompt {{placeholder}} in the space name and space type", () => {
  test("rejects a {{transcript}} token in the space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "Room {{transcript}}" }),
      /buildReasonPrompt: spaceName must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{frame_list}} token in the space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "Room {{frame_list}}" }),
      /buildReasonPrompt: spaceName must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{space_name}} token in the space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: "room {{space_name}}" }),
      /buildReasonPrompt: spaceType must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{transcript}} token in the space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: "room {{transcript}}" }),
      /buildReasonPrompt: spaceType must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("still builds a clean reason prompt", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes("Sanctuary"));
    assert.ok(prompt.includes("church sanctuary"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still allows newlines in the transcript", () => {
    const prompt = buildReasonPrompt({
      ...base,
      transcript: "First line.\nSecond line.",
    });
    assert.ok(prompt.includes("First line.\nSecond line."));
  });
});
