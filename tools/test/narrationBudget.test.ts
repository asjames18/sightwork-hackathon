import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { frameBudgetBytes, pickFrameTimes, MIN_FRAME_BYTES, REQUEST_OVERHEAD_BYTES } from "@/lib/client/buildPlanRequest";
import { createApiPlanJob, NARRATION_SEND_FAIL } from "@/lib/client/apiPlanJob";
import { saveTestCode } from "@/lib/client/testCode";
import { saveLocation } from "@/lib/client/location";
import type { PlanJobStatus, PlanRequest } from "@/lib/types";
import { fakeWindow } from "./browser-stubs";

/** Base64 length of a 16 kHz mono 16-bit WAV of `sec` seconds (what extractNarration makes). */
const wavChars = (sec: number) => Math.ceil((44 + sec * 16000 * 2) / 3) * 4;
const VERCEL_BUDGET = 4_300_000; // production NEXT_PUBLIC_SIGHTWORK_MAX_REQUEST_BYTES

describe("frame budget with narration (2026-10-31: 90 s iPhone take refused as too long)", () => {
  test("old math: a narrated take over about 80 s couldn't fit when the WAV shared the plan request", () => {
    for (const sec of [85, 90, 120]) assert.equal(frameBudgetBytes(VERCEL_BUDGET, wavChars(sec), pickFrameTimes(sec).length, false), null, String(sec));
    assert.notEqual(frameBudgetBytes(VERCEL_BUDGET, wavChars(60), pickFrameTimes(60).length, false), null);
  });

  test("split narration: 60 to 90 s narrated takes get the whole plan budget for frames", () => {
    for (const sec of [30, 60, 75, 90]) {
      const n = pickFrameTimes(sec).length;
      const budget = frameBudgetBytes(VERCEL_BUDGET, wavChars(sec), n, true);
      assert.equal(budget, VERCEL_BUDGET - REQUEST_OVERHEAD_BYTES, String(sec));
      assert.ok((budget as number) / n >= MIN_FRAME_BYTES);
    }
  });

  test("split narration: the WAV must still fit a request of its own", () => {
    assert.equal(frameBudgetBytes(VERCEL_BUDGET, wavChars(110), pickFrameTimes(110).length, true), null);
    assert.equal(frameBudgetBytes(VERCEL_BUDGET, VERCEL_BUDGET - REQUEST_OVERHEAD_BYTES + 1, 10, true), null);
    assert.notEqual(frameBudgetBytes(VERCEL_BUDGET, VERCEL_BUDGET - REQUEST_OVERHEAD_BYTES, 10, true), null);
  });

  test("no narration: unchanged either way", () => {
    for (const sep of [true, false]) assert.equal(frameBudgetBytes(VERCEL_BUDGET, 0, 48, sep), VERCEL_BUDGET - REQUEST_OVERHEAD_BYTES);
  });
});

describe("API runner: WAV fallback over the body cap", () => {
  async function run(transcribe: () => Response, body: PlanRequest, cap: number | undefined) {
    fakeWindow();
    saveTestCode("tester-9");
    saveLocation({ city: "Sebring", state: "FL" });
    const urls: string[] = [];
    const real = globalThis.fetch;
    const warn = console.warn;
    console.warn = () => {};
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      if (url === "/api/transcribe") return transcribe();
      return new Response('{"state":"done","plan":{"issues":[]}}\n', { status: 200 });
    }) as typeof fetch;
    const statuses: PlanJobStatus[] = [];
    try {
      await createApiPlanJob(async () => body, "/api/plan", "/api/transcribe", cap)({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
    } finally {
      globalThis.fetch = real;
      console.warn = warn;
    }
    return { urls, last: statuses[statuses.length - 1] };
  }
  const big = { durationSec: 90, frames: [{ tSec: 1, dataUrl: "data:image/jpeg;base64," + "A".repeat(5000) }], audioWavBase64: "UklGRg==" + "A".repeat(4000) } as unknown as PlanRequest;

  test("transcribe failed and frames + WAV are over the cap: plain message, no plan upload", async () => {
    const { urls, last } = await run(() => new Response("{}", { status: 500 }), big, 6000);
    assert.deepEqual(urls, ["/api/transcribe"]);
    assert.equal(last?.state === "failed" ? last.message : undefined, NARRATION_SEND_FAIL);
  });

  test("transcribe worked: the transcript-only request goes out even with a small cap", async () => {
    const ok = () => new Response(JSON.stringify({ transcript: "[0] hi", transcriptTurns: [{ startSec: 0, text: "hi" }] }), { status: 200 });
    const { urls, last } = await run(ok, big, 6000);
    assert.deepEqual(urls, ["/api/transcribe", "/api/plan"]);
    assert.equal(last?.state, "done");
  });

  test("transcribe failed but the WAV fallback fits (or no cap given): the plan request still carries it", async () => {
    for (const cap of [1_000_000, undefined]) {
      const { urls, last } = await run(() => new Response("{}", { status: 500 }), big, cap);
      assert.deepEqual(urls, ["/api/transcribe", "/api/plan"]);
      assert.equal(last?.state, "done");
    }
  });
});
