/** Reason step validator (validateReasonRequest) blank transcript: a
 * direct runReason caller gets the same fail-fast as buildReasonPrompt
 * and the route/runPlan validators — null means no narration, but a
 * blank string is neither a transcript nor null, so it must not ride
 * into the finished plan. Real transcripts from /api/transcribe are
 * never blank, so no current run changes. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function input(transcript: unknown): ReasonInput {
  return {
    frames: [{ tSec: 0, dataUrl: PNG_1PX }],
    segmentation: null,
    transcript: transcript as ReasonInput["transcript"],
    durationSec: 10,
  };
}

function deps(): ReasonDeps {
  return {
    prompt: "p",
    schema: {},
    callSpark: async () => {
      throw new Error("test: callSpark reached");
    },
    tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
  };
}

test("an empty or whitespace-only transcript is rejected", () => {
  assert.throws(() => validateReasonRequest(input(""), deps()), {
    message: "reason: transcript must not be blank",
  });
  assert.throws(() => validateReasonRequest(input("   "), deps()), {
    message: "reason: transcript must not be blank",
  });
});

test("a null transcript and a transcript with words pass", () => {
  assert.doesNotThrow(() => validateReasonRequest(input(null), deps()));
  assert.doesNotThrow(() => validateReasonRequest(input("fix the stage"), deps()));
});

test("a non-string transcript keeps its own message", () => {
  assert.throws(() => validateReasonRequest(input(42), deps()), {
    message: "reason: transcript must be a string or null",
  });
});
