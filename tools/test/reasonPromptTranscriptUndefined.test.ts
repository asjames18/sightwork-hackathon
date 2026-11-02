/**
 * buildReasonPrompt rejects an undefined transcript, instead of
 * building the prompt with the literal "(no narration)" even though
 * the transcribe step never ran and never reported silence — the
 * caller simply omitted the field, and the model treated every
 * issue as unmentioned with no warning that the narration was
 * missing rather than silent. ReasonInput requires transcript (a
 * string or null, not optional), and runReason's own validator
 * already rejects an undefined transcript before any paid call, so
 * a direct buildReasonPrompt caller gets the same fail-fast here. A
 * non-string transcript is rejected the same way, and null
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

describe("buildReasonPrompt transcript undefined", () => {
  test("rejects an undefined transcript", () => {
    assert.throws(
      () => buildReasonPrompt(withTranscript(undefined)),
      /buildReasonPrompt: transcript must be a string or null/,
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
