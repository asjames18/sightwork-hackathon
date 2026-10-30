/** validateTranscribeInput treats an empty spaceType as "not given", matching the plan route validators (07ae729). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTranscribe, validateTranscribeInput, type TranscribeCaller } from "@/lib/pipeline/transcribe";
import { validatePlanRequest } from "@/lib/pipeline/planRequest";
import { createUsageTracker } from "@/lib/pipeline/usage";

/** A tiny mono 16-bit 16 kHz PCM WAV. */
function wav(channels = 1): string {
  const data = Buffer.alloc(32);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(16000 * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString("base64");
}

const SPACE_MESSAGE = "transcribe: spaceType is not a non-empty string";
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("empty, absent and named spaceType pass", () => {
  assert.doesNotThrow(() => validateTranscribeInput({ audioWavBase64: wav(), spaceType: "" }));
  assert.doesNotThrow(() => validateTranscribeInput({ audioWavBase64: wav() }));
  assert.doesNotThrow(() => validateTranscribeInput({ audioWavBase64: wav(), spaceType: "sanctuary" }));
  assert.doesNotThrow(() => validateTranscribeInput({ spaceType: "" }));
});

test("spaces-only and non-string spaceType still fail with the same message", () => {
  assert.throws(() => validateTranscribeInput({ audioWavBase64: wav(), spaceType: "   " }), { message: SPACE_MESSAGE });
  assert.throws(() => validateTranscribeInput({ audioWavBase64: wav(), spaceType: 3 as unknown as string }), {
    message: SPACE_MESSAGE,
  });
});

test("stereo audio still fails the format check with an empty spaceType", () => {
  assert.throws(() => validateTranscribeInput({ audioWavBase64: wav(2), spaceType: "" }), {
    message: /^transcribe: audio must be mono s16le WAV/,
  });
});

test("the plan route validator and transcribe agree on spaceType \"\"", () => {
  const body = { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], audioWavBase64: wav(), spaceType: "" };
  assert.deepEqual(validatePlanRequest(body), []);
  assert.doesNotThrow(() => validateTranscribeInput({ audioWavBase64: body.audioWavBase64, spaceType: body.spaceType }));
});

test("runTranscribe with spaceType \"\" reaches the model and the cleanup prompt says room", async () => {
  let calls = 0;
  const callTranscribe: TranscribeCaller = async () => {
    calls++;
    return { turns: [{ startSec: 1, text: "two chairs are broken" }], latencyMs: 1, costUsd: 0 };
  };
  let prompt = "";
  const out = await runTranscribe(
    { audioWavBase64: wav(), spaceType: "" },
    {
      callTranscribe,
      tracker: createUsageTracker(),
      cleanupPrompt: "space={{space_type}}\n{{raw_turns}}",
      callCleanup: async (req) => {
        prompt = req.prompt;
        return { text: "[1.0] two chairs are broken", latencyMs: 1, costUsd: 0 };
      },
    },
  );
  assert.equal(calls, 1);
  assert.match(prompt, /^space=room\n/);
  assert.equal(out.transcriptTurns.length, 1);
  assert.ok(out.transcript?.includes("two chairs are broken"));
});
