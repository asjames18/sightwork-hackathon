import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  NARRATION_CHUNK_MAX_SEC,
  narrationChunkMaxSec,
  pcmToWav,
  planChunkCuts,
  readWav,
  shiftTranscriptLine,
  splitNarrationWav,
  stitchChunkTranscripts,
} from "@/lib/client/narrationChunks";
import { bytesToBase64, encodeWav, REQUEST_OVERHEAD_BYTES } from "@/lib/client/buildPlanRequest";
import { splitNarration } from "@/lib/client/apiPlanJob";
import type { PlanRequest } from "@/lib/types";

const SR = 16000;

/** "Speech" (a loud tone) everywhere except short pauses at the given seconds. */
function speechWithPauses(totalSec: number, pausesAt: number[], pauseSec = 0.4): Int16Array {
  const pcm = new Int16Array(Math.round(totalSec * SR));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SR));
  for (const p of pausesAt) {
    const a = Math.round((p - pauseSec / 2) * SR);
    const b = Math.round((p + pauseSec / 2) * SR);
    for (let i = Math.max(0, a); i < Math.min(pcm.length, b); i++) pcm[i] = 0;
  }
  return pcm;
}

const b64 = (pcm: Int16Array) => bytesToBase64(pcmToWav(pcm, SR));

describe("narration chunk size", () => {
  test("80 s chunks fit the 4.3 MB Vercel budget with room to spare; smaller budgets get shorter chunks", () => {
    assert.equal(narrationChunkMaxSec(4_300_000), NARRATION_CHUNK_MAX_SEC);
    const chunkChars = Math.ceil((44 + NARRATION_CHUNK_MAX_SEC * SR * 2) / 3) * 4;
    assert.ok(chunkChars + REQUEST_OVERHEAD_BYTES < 4_300_000 * 0.85, String(chunkChars));
    const small = narrationChunkMaxSec(1024 * 1024);
    assert.ok(small < 80 && small >= 10);
    const chars = Math.ceil((44 + small * SR * 2) / 3) * 4;
    assert.ok(chars + REQUEST_OVERHEAD_BYTES <= 1024 * 1024);
  });
});

describe("WAV read and write", () => {
  test("pcmToWav matches encodeWav's header and readWav reads it back", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const wav = pcmToWav(pcm, SR);
    const info = readWav(wav)!;
    assert.deepEqual(info, { channels: 1, sampleRate: SR, bitsPerSample: 16, dataOffset: 44, dataBytes: 10 });
    const fromFloat = encodeWav(new Float32Array([0, 0.5]), SR);
    assert.deepEqual(Array.from(fromFloat.subarray(0, 40)), Array.from(pcmToWav(new Int16Array(2), SR).subarray(0, 40)));
    assert.equal(readWav(new Uint8Array(50)), null);
  });
});

describe("planChunkCuts", () => {
  test("a take that fits one chunk is not cut", () => {
    const pcm = speechWithPauses(60, []);
    assert.deepEqual(planChunkCuts(pcm, SR, 80), [0, pcm.length]);
  });

  test("cuts land in the pause just before the limit, and no chunk passes it", () => {
    const pcm = speechWithPauses(300, [74, 150, 222, 290]);
    const cuts = planChunkCuts(pcm, SR, 80);
    assert.equal(cuts[0], 0);
    assert.equal(cuts[cuts.length - 1], pcm.length);
    for (let k = 1; k < cuts.length; k++) assert.ok(cuts[k] - cuts[k - 1] <= 80 * SR, `chunk ${k}`);
    // Each cut is inside a pause (silence at the cut sample).
    for (const c of cuts.slice(1, -1)) assert.equal(pcm[c], 0, `cut at ${c / SR}`);
    assert.ok(Math.abs(cuts[1] / SR - 74) < 0.25, String(cuts[1] / SR));
    assert.ok(Math.abs(cuts[2] / SR - 150) < 0.25, String(cuts[2] / SR));
  });

  test("no pause at all: still cut, never longer than the limit", () => {
    const pcm = speechWithPauses(181, []);
    const cuts = planChunkCuts(pcm, SR, 80);
    for (let k = 1; k < cuts.length; k++) assert.ok(cuts[k] - cuts[k - 1] <= 80 * SR);
    assert.equal(cuts.length, 4);
  });
});

describe("splitNarrationWav", () => {
  test("short narration is sent whole (null); junk is left alone", () => {
    assert.equal(splitNarrationWav(b64(speechWithPauses(79, []))), null);
    assert.equal(splitNarrationWav("not base64 at all!!"), null);
    assert.equal(splitNarrationWav("UklGRg==" + "A".repeat(100)), null);
  });

  test("5 min narration: chunks under 80 s each, offsets add up, samples are kept exactly", () => {
    const pcm = speechWithPauses(300, [70, 145, 220]);
    const chunks = splitNarrationWav(b64(pcm))!;
    assert.ok(chunks.length >= 4);
    let at = 0;
    let total = 0;
    for (const c of chunks) {
      assert.ok(Math.abs(c.startSec - at) < 1e-9);
      assert.ok(c.durationSec <= 80);
      assert.equal(c.silent, false);
      // Each chunk is a valid mono 16 kHz WAV that fits the Vercel budget on its own.
      assert.ok(c.wavBase64.length + REQUEST_OVERHEAD_BYTES < 4_300_000);
      at += c.durationSec;
      total += c.durationSec;
    }
    assert.ok(Math.abs(total - 300) < 1e-6);
  });

  test("a silent stretch is marked silent so it isn't sent", () => {
    const pcm = speechWithPauses(170, []);
    for (let i = 76 * SR; i < pcm.length; i++) pcm[i] = 0;
    const chunks = splitNarrationWav(b64(pcm))!;
    assert.equal(chunks[0].silent, false);
    assert.ok(chunks.slice(1).every((c) => c.silent));
  });
});

describe("stitchChunkTranscripts", () => {
  test("turn times and transcript lines move by each chunk's offset", () => {
    const out = stitchChunkTranscripts([
      { offsetSec: 74.2, transcript: "[0.5] the carpet is torn\n[12.0] light out", transcriptTurns: [{ startSec: 0.5, endSec: 3, text: "the carpet is torn" }, { startSec: 12, text: "light out" }] },
      { offsetSec: 0, transcript: "[1.0] now the stage", transcriptTurns: [{ startSec: 1, endSec: 2.5, text: "now the stage" }] },
      { offsetSec: 150, transcript: null, transcriptTurns: [] },
    ]);
    assert.equal(out.transcript, "[1.0] now the stage\n[74.7] the carpet is torn\n[86.2] light out");
    assert.deepEqual(out.transcriptTurns, [
      { startSec: 1, endSec: 2.5, text: "now the stage" },
      { startSec: 74.7, endSec: 77.2, text: "the carpet is torn" },
      { startSec: 86.2, text: "light out" },
    ]);
  });
  test("no speech in any chunk is null, like one quiet request", () => {
    assert.deepEqual(stitchChunkTranscripts([{ offsetSec: 0, transcript: null, transcriptTurns: [] }]), { transcript: null, transcriptTurns: [] });
  });
  test("lines without a time stay as they are", () => {
    assert.equal(shiftTranscriptLine("no time here", 10), "no time here");
    assert.equal(shiftTranscriptLine("[3] hi", 10), "[13.0] hi");
  });
});

describe("splitNarration with chunks (mocked /api/transcribe)", () => {
  async function withFetch(handler: (body: { audioWavBase64: string }) => Response, req: PlanRequest) {
    const real = globalThis.fetch;
    const warn = console.warn;
    console.warn = () => {};
    const calls: number[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { audioWavBase64: string };
      const info = readWav(Uint8Array.from(atob(body.audioWavBase64), (c) => c.charCodeAt(0)))!;
      calls.push(info.dataBytes / 2 / SR);
      return handler(body);
    }) as typeof fetch;
    try {
      return { out: await splitNarration(req, "/api/transcribe", "code", new AbortController().signal), calls };
    } finally {
      globalThis.fetch = real;
      console.warn = warn;
    }
  }
  const answer = (text: string, cost = 0.001) =>
    new Response(JSON.stringify({ transcript: `[2.0] ${text}`, transcriptTurns: [{ startSec: 2, endSec: 4, text }], costUsd: cost }), { status: 200 });

  test("a 3 min narration goes as several requests, each under 80 s; times come back in take time and costs add up", async () => {
    const pcm = speechWithPauses(180, [75, 150]);
    const req = { durationSec: 180, frames: [], audioWavBase64: b64(pcm), spaceType: "gym" } as unknown as PlanRequest;
    let n = 0;
    const { out, calls } = await withFetch(() => answer(`part ${++n}`), req);
    assert.ok(calls.length >= 3 && calls.every((s) => s <= 80), String(calls));
    assert.notEqual(out, "unauthorized");
    const r = out as { body: PlanRequest; costUsd: number };
    assert.equal(r.body.audioWavBase64, undefined);
    assert.equal(r.costUsd, Math.round(calls.length * 0.001 * 1e6) / 1e6);
    const turns = r.body.transcriptTurns!;
    assert.equal(turns.length, calls.length);
    assert.equal(turns[0].startSec, 2);
    let offset = 0;
    for (let i = 0; i < calls.length; i++) {
      assert.ok(Math.abs(turns[i].startSec - (offset + 2)) < 0.01, `turn ${i}`);
      offset += calls[i];
    }
    assert.match(r.body.transcript!, /^\[2\.0\] part 1\n\[7\d\.\d\] part 2/);
  });

  test("a failed chunk is tried once more; still failing keeps the WAV (narration never dropped)", async () => {
    const pcm = speechWithPauses(120, [75]);
    const req = { durationSec: 120, frames: [], audioWavBase64: b64(pcm) } as unknown as PlanRequest;
    let n = 0;
    const flaky = await withFetch(() => (++n === 1 ? new Response("{}", { status: 503 }) : answer("ok")), req);
    assert.equal(flaky.calls.length, 3);
    assert.equal((flaky.out as { body: PlanRequest }).body.audioWavBase64, undefined);
    const down = await withFetch(() => new Response(JSON.stringify({ error: "x", costUsd: 0.002 }), { status: 500 }), req);
    assert.equal(down.calls.length, 2);
    const kept = down.out as { body: PlanRequest; costUsd: number };
    assert.equal(kept.body.audioWavBase64, req.audioWavBase64);
    assert.equal(kept.costUsd, 0.004);
  });

  test("401 on any chunk stops with unauthorized", async () => {
    const req = { durationSec: 120, frames: [], audioWavBase64: b64(speechWithPauses(120, [75])) } as unknown as PlanRequest;
    const { out } = await withFetch(() => new Response("{}", { status: 401 }), req);
    assert.equal(out, "unauthorized");
  });

  test("short narration still goes as one request, unchanged", async () => {
    const req = { durationSec: 40, frames: [], audioWavBase64: b64(speechWithPauses(40, [])) } as unknown as PlanRequest;
    const { out, calls } = await withFetch(() => answer("hello"), req);
    assert.equal(calls.length, 1);
    assert.deepEqual((out as { body: PlanRequest }).body.transcriptTurns, [{ startSec: 2, endSec: 4, text: "hello" }]);
  });
});
