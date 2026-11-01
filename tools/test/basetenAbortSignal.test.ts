/**
 * Offline test of the Baseten caller's abort signal
 * (src/lib/meta/baseten.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight Baseten call ran
 * to completion and billed, because no signal reached its
 * fetch. A signal on the call request is now passed to the
 * fetch, and an already-aborted signal throws an AbortError
 * before any fetch, so it spends nothing. The reason adapter
 * forwards the signal too. Until the pipeline steps pass their
 * run signal through, omitting the signal behaves exactly as
 * before. Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBasetenClient, createReasonBasetenCaller } from "@/lib/meta/baseten";

const SCHEMA = { type: "object", properties: {}, required: [] };
const BODY = JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
  usage: { prompt_tokens: 100, completion_tokens: 100 },
});

function harness(fetchImpl: typeof fetch) {
  return createBasetenClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

function okResponse() {
  return new Response(BODY, { status: 200, headers: { "Content-Type": "application/json" } });
}

test("an already-aborted signal throws AbortError and never fetches", async () => {
  let fetched = 0;
  const client = harness((async () => {
    fetched += 1;
    return okResponse();
  }) as unknown as typeof fetch);
  const controller = new AbortController();
  controller.abort();
  let caught: unknown;
  try {
    await client.callSpark({ model: "meta-models/muse-spark-open-1026", prompt: "p", schema: SCHEMA, signal: controller.signal });
  } catch (err) {
    caught = err;
  }
  assert.equal((caught as Error).name, "AbortError");
  assert.equal(fetched, 0);
});

test("a live signal is passed to the fetch and the call succeeds", async () => {
  let seen: AbortSignal | undefined | null = null;
  const client = harness((async (_url: unknown, init: unknown) => {
    seen = (init as { signal?: AbortSignal }).signal ?? null;
    return okResponse();
  }) as unknown as typeof fetch);
  const controller = new AbortController();
  const res = await client.callSpark({ model: "meta-models/muse-spark-open-1026", prompt: "p", schema: SCHEMA, signal: controller.signal });
  assert.deepEqual(res.json, { ok: true });
  assert.equal(seen, controller.signal);
});

test("omitting the signal leaves the fetch without one, as before", async () => {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const client = harness((async (_url: unknown, init: unknown) => {
    seenKey = "signal" in (init as Record<string, unknown>);
    seen = (init as { signal?: AbortSignal }).signal;
    return okResponse();
  }) as unknown as typeof fetch);
  const res = await client.callSpark({ model: "meta-models/muse-spark-open-1026", prompt: "p", schema: SCHEMA });
  assert.deepEqual(res.json, { ok: true });
  assert.equal(seen, undefined);
  assert.equal(seenKey, true);
});

test("aborting mid-flight rejects the call with AbortError", async () => {
  const client = harness((( _url: unknown, init: unknown) => {
    const signal = (init as { signal?: AbortSignal }).signal;
    return new Promise((_resolve, reject) => {
      signal?.addEventListener(
        "abort",
        () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        },
        { once: true },
      );
    });
  }) as unknown as typeof fetch);
  const controller = new AbortController();
  const pending = client.callSpark({ model: "meta-models/muse-spark-open-1026", prompt: "p", schema: SCHEMA, signal: controller.signal });
  // Abort after the fetch started but before it resolved: the
  // listener in the fake fetch rejects the pending call.
  controller.abort();
  await assert.rejects(pending, (err: unknown) => (err as Error).name === "AbortError");
});

test("the Baseten reason adapter forwards the signal to the client", async () => {
  let seen: AbortSignal | undefined = undefined;
  const fakeClient = {
    callSpark: async (req: { signal?: AbortSignal }) => {
      seen = req.signal;
      return { json: {}, latencyMs: 1, costUsd: 0, model: "meta-models/muse-spark-open-1026" };
    },
  } as unknown as Parameters<typeof createReasonBasetenCaller>[0];
  const controller = new AbortController();
  const caller = createReasonBasetenCaller(fakeClient);
  await caller({ model: "meta-models/muse-spark-open-1026", prompt: "p", images: [], schema: SCHEMA, signal: controller.signal });
  assert.equal(seen, controller.signal);
});
