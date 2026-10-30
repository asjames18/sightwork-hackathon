/** runPlan's own validator (validateRunPlanRequest) checks the WAV format of audioWavBase64, matching the route validator. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(audioWavBase64: unknown): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], audioWavBase64 } as unknown as PlanRequest;
}

/** A tiny PCM WAV: 44-byte header plus a few silent samples. */
function wav(opts: { channels?: number; sampleRate?: number; bits?: number } = {}): string {
  const channels = opts.channels ?? 1;
  const sampleRate = opts.sampleRate ?? 16000;
  const bits = opts.bits ?? 16;
  const data = Buffer.alloc(32);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  h.writeUInt16LE((channels * bits) / 8, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString("base64");
}

test("mono 16-bit WAV at 16000 and 24000 Hz passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req(wav({ sampleRate: 16000 }))));
  assert.doesNotThrow(() => validateRunPlanRequest(req(wav({ sampleRate: 24000 }))));
});

test("empty audio means no narration and passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req("")));
  assert.doesNotThrow(() => validateRunPlanRequest(req(undefined)));
});

test("stereo, 8 kHz and 8-bit WAVs fail with the format message", () => {
  const message =
    "runPlan: audioWavBase64 must be mono 16-bit WAV at 16000 or 24000 Hz (the format Meta transcribe accepts)";
  assert.throws(() => validateRunPlanRequest(req(wav({ channels: 2 }))), { message });
  assert.throws(() => validateRunPlanRequest(req(wav({ sampleRate: 8000 }))), { message });
  assert.throws(() => validateRunPlanRequest(req(wav({ bits: 8 }))), { message });
});

test("valid base64 that is not a WAV fails with the header message", () => {
  const notWav = Buffer.from("this is plain text, not audio at all, long enough").toString("base64");
  assert.throws(() => validateRunPlanRequest(req(notWav)), {
    message: "runPlan: audioWavBase64 must be a WAV file (RIFF/WAVE header)",
  });
});

test("a non-base64 string fails with the base64 message", () => {
  assert.throws(() => validateRunPlanRequest(req("not base64 !!!")), {
    message: "runPlan: audioWavBase64 must be valid base64",
  });
});

test("blank and non-string audio keep their own messages", () => {
  assert.throws(() => validateRunPlanRequest(req("   ")), {
    message: "runPlan: audioWavBase64 must not be blank when given",
  });
  assert.throws(() => validateRunPlanRequest(req(42)), {
    message: "runPlan: audioWavBase64 must be a string when given",
  });
});
