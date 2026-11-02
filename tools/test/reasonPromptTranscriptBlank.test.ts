/**
 * buildReasonPrompt rejects a blank transcript, instead of
 * building the prompt with an empty TRANSCRIPT section — neither
 * the speaker's words nor the explicit "(no narration)" marker,
 * so step 2's null-if-no-narration rule had nothing to key on and
 * the model could treat an empty section as silence or invent
 * narration. runPlan's own validator already rejects a blank
 * transcript before any paid call, so a direct buildReasonPrompt
 * caller bypassing runPlan gets the same fail-fast here. A
 * whitespace-only transcript fails the same way, and null
 * transcript still builds the explicit "(no narration)" prompt.
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

function withTranscript(transcript: unknown): ReasonInput {
  return {
    ...base,
    transcript: transcript as ReasonInput["transcript"],
  };
}

describe("buildReasonPrompt transcript blank", () => {
  test("rejects an empty string transcript", () => {
    assert.throws(
      () => buildReasonPrompt(withTranscript("")),
      /buildReasonPrompt: transcript must not be blank/,
    );
  });

  test("rejects a whitespace-only transcript", () => {
    assert.throws(
      () => buildReasonPrompt(withTranscript("  \n ")),
      /buildReasonPrompt: transcript must not be blank/,
    );
  });

  test("still rejects a non-string transcript, naming the field", () => {
    assert.throws(
      () => buildReasonPrompt(withTranscript(42)),
      /buildReasonPrompt: transcript must be a string or null/,
    );
  });

  test("still builds a clean reason prompt with a transcript", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes("Hello transcript."));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still builds the no-narration prompt with null transcript", () => {
    const prompt = buildReasonPrompt({ ...base, transcript: null });
    assert.ok(prompt.includes("(no narration)"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
