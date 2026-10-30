/** runPlan's own validator (validateRunPlanRequest) fails fast on audio over the 32 MB transcribe cap. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import { MAX_AUDIO_BYTES } from "@/lib/pipeline/transcribe";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(audioWavBase64: unknown): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], audioWavBase64 } as unknown as PlanRequest;
}

/** Valid base64 text of `chars` characters (keep it a multiple of 4). */
function b64Chars(chars: number): string {
  return "A".repeat(chars);
}

/** 44739244 chars count as 32 MB + 1 byte; 44739240 chars as 2 bytes under the cap. */
const OVER_CAP_CHARS = 44739244;
const UNDER_CAP_CHARS = 44739240;

test("the counting matches the cap boundary", () => {
  assert.equal(Math.floor((OVER_CAP_CHARS * 3) / 4), MAX_AUDIO_BYTES + 1);
  assert.equal(Math.floor((UNDER_CAP_CHARS * 3) / 4), MAX_AUDIO_BYTES - 2);
});

test("the cap is 32 MB, the same constant the transcribe step uses", () => {
  assert.equal(MAX_AUDIO_BYTES, 32 * 1024 * 1024);
});

test("32 MB + 1 byte fails with the size message", () => {
  assert.throws(() => validateRunPlanRequest(req(b64Chars(OVER_CAP_CHARS))), {
    message: `runPlan: audioWavBase64 must be at most 32 MB, got ${MAX_AUDIO_BYTES + 1} bytes`,
  });
});

test("just under the cap the size check passes and only the WAV header check fails", () => {
  assert.throws(() => validateRunPlanRequest(req(b64Chars(UNDER_CAP_CHARS))), {
    message: "runPlan: audioWavBase64 must be a WAV file (RIFF/WAVE header)",
  });
});

test("whitespace does not count toward the size", () => {
  const underCap = b64Chars(UNDER_CAP_CHARS);
  const withBreaks = underCap.replace(/(.{76})/g, "$1\n");
  assert.throws(() => validateRunPlanRequest(req(withBreaks)), {
    message: "runPlan: audioWavBase64 must be a WAV file (RIFF/WAVE header)",
  });
});

test("blank and non-base64 keep their own messages ahead of the size check", () => {
  assert.throws(() => validateRunPlanRequest(req("   ")), {
    message: "runPlan: audioWavBase64 must not be blank when given",
  });
  assert.throws(() => validateRunPlanRequest(req("!".repeat(100))), {
    message: "runPlan: audioWavBase64 must be valid base64",
  });
});

test("no audio and empty audio still pass", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req(undefined)));
  assert.doesNotThrow(() => validateRunPlanRequest(req("")));
});
