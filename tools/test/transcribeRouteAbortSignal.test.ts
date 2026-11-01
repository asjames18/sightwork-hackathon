/** POST /api/transcribe abort signal (2026-11-01): the plan route
 * already hands its request signal to runPlan's transcribe deps, but
 * the standalone transcribe route never passed one, so a split run
 * whose client went away still paid for the whole ASR call. The route
 * now forwards req.signal: aborting mid-flight reaches the ASR fetch
 * (the same signal object), the fetch rejects, and the run fails with
 * no second call and no spend recorded. Fake key + stubbed fetch
 * only; no network, no key, no paid call. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../src/app/api/transcribe/route";

/** A tiny PCM WAV: 44-byte header plus a few silent samples (mono 16-bit 16 kHz). */
function wav(): string {
  const data = Buffer.alloc(32);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]).toString("base64");
}

function post(body: string, signal?: AbortSignal): Request {
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    body,
    ...(signal ? { signal } : {}),
  });
}

/** Run fn with a dummy key set and fetch stubbed to hang until the
 * signal it was given aborts, then reject with an AbortError — the
 * shape a real fetch rejection takes mid-flight. */
async function withAbortingFetch(
  fn: (state: { calls: () => number; seenSignal: () => unknown }) => Promise<void>,
): Promise<void> {
  const prevKey = process.env.MODEL_API_KEY;
  const prevFetch = globalThis.fetch;
  let calls = 0;
  let seen: unknown;
  process.env.MODEL_API_KEY = "test-key";
  globalThis.fetch = ((...args: [unknown, { signal?: AbortSignal }?]) => {
    calls++;
    const init = args[1];
    seen = init?.signal;
    return new Promise((_resolve, reject) => {
      const err = new Error("asr: aborted");
      err.name = "AbortError";
      if (init?.signal?.aborted) {
        reject(err);
        return;
      }
      init?.signal?.addEventListener("abort", () => reject(err), { once: true });
    });
  }) as typeof fetch;
  try {
    await fn({ calls: () => calls, seenSignal: () => seen });
  } finally {
    if (prevKey === undefined) delete process.env.MODEL_API_KEY;
    else process.env.MODEL_API_KEY = prevKey;
    globalThis.fetch = prevFetch;
  }
}

test("POST: aborting mid-flight reaches the ASR fetch and fails with no second call", async () => {
  await withAbortingFetch(async (state) => {
    const controller = new AbortController();
    const resPromise = POST(post(JSON.stringify({ audioWavBase64: wav() }), controller.signal));
    // Wait until the route has actually reached the ASR fetch, so the
    // abort below is mid-flight rather than before the call starts.
    for (let i = 0; i < 100 && state.calls() === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(state.calls(), 1);
    assert.equal(state.seenSignal(), controller.signal);
    controller.abort();
    const res = await resPromise;
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "We couldn't transcribe that narration. Try again.",
      costUsd: 0,
    });
    assert.equal(state.calls(), 1);
  });
});
