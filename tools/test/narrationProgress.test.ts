import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { narrationPartLine, pcmToWav } from "@/lib/client/narrationChunks";
import { bytesToBase64 } from "@/lib/client/buildPlanRequest";
import { splitNarration } from "@/lib/client/apiPlanJob";
import type { PlanRequest } from "@/lib/types";

const SR = 16000;
/** Steady tone with short quiet gaps at the given seconds, so the splitter has places to cut. */
function speechWithPauses(totalSec: number, pausesAt: number[], pauseSec = 0.4): Int16Array {
  const pcm = new Int16Array(Math.round(totalSec * SR));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SR));
  for (const at of pausesAt) pcm.fill(0, Math.round(at * SR), Math.round((at + pauseSec) * SR));
  return pcm;
}
const b64 = (pcm: Int16Array) => bytesToBase64(pcmToWav(pcm, SR));

async function run(req: PlanRequest) {
  const real = globalThis.fetch;
  const warn = console.warn;
  console.warn = () => {};
  const seen: ({ at: number; of: number } | undefined)[] = [];
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ transcript: "[1.0] hi", transcriptTurns: [{ startSec: 1, text: "hi" }], costUsd: 0.001 }), { status: 200 });
  }) as typeof fetch;
  try {
    const out = await splitNarration(req, "/api/transcribe", "code", new AbortController().signal, undefined, (p) => {
      seen.push(p);
      // Each part is announced before its own request goes out.
      assert.equal(calls, seen.length - 1);
    });
    return { out, seen, calls };
  } finally {
    globalThis.fetch = real;
    console.warn = warn;
  }
}

describe("narration progress on the processing screen", () => {
  test("a long narration reports part 1..N of N, one before each request", async () => {
    const req = { durationSec: 180, frames: [], audioWavBase64: b64(speechWithPauses(180, [75, 150])) } as unknown as PlanRequest;
    const { out, seen, calls } = await run(req);
    assert.notEqual(out, "unauthorized");
    assert.ok(calls >= 3);
    assert.equal(seen.length, calls);
    seen.forEach((p, i) => assert.deepEqual(p, { at: i + 1, of: calls }));
  });
  test("a short narration reports once, with no part", async () => {
    const req = { durationSec: 30, frames: [], audioWavBase64: b64(speechWithPauses(30, [10])) } as unknown as PlanRequest;
    const { seen, calls } = await run(req);
    assert.equal(calls, 1);
    assert.deepEqual(seen, [undefined]);
  });
  test("no narration, or a transcript already there: nothing reported, nothing sent", async () => {
    for (const req of [
      { durationSec: 30, frames: [] },
      { durationSec: 30, frames: [], audioWavBase64: "AAAA", transcript: null },
    ] as unknown as PlanRequest[]) {
      const { seen, calls } = await run(req);
      assert.deepEqual(seen, []);
      assert.equal(calls, 0);
    }
  });
  test("the screen line names the part, and stays quiet for one piece or a bad count", () => {
    assert.equal(narrationPartLine({ at: 2, of: 4 }), "Your narration is long, so it goes in 4 parts. Reading part 2 of 4.");
    for (const bad of [null, undefined, { at: 1, of: 1 }, { at: 0, of: 3 }, { at: 4, of: 3 }, { at: 1.5, of: 3 }]) {
      assert.equal(narrationPartLine(bad), null);
    }
  });
});
