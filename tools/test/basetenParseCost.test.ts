/**
 * Offline test of the Baseten caller's cost-carrying parse failures
 * (src/lib/meta/baseten.ts). A 200 response whose answer text is not
 * JSON, or that has no text at all, still spent its tokens: usage is
 * priced before the text is parsed (mirroring ./client.ts), so the
 * failure throws BasetenCallError with costUsd/latencyMs and the
 * pipeline step's recordFailedCall can record it instead of dropping
 * the spend from the route total. Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BasetenCallError, createBasetenClient } from "@/lib/meta/baseten";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

const EXPECTED_COST = (1000 * 1.25 + 100 * 4.25) / 1_000_000;

function harness(body: string) {
  const fetchImpl = (async () =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  const client = createBasetenClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return client;
}

const req = { model: "ignored", prompt: "compare", schema: { type: "object" } };

function usageBody(content: unknown) {
  return JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 1000, completion_tokens: 100 },
  });
}

async function expectCostError(client: ReturnType<typeof createBasetenClient>, pattern: RegExp) {
  let caught: unknown;
  try {
    await client.callSpark(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof BasetenCallError, `expected BasetenCallError, got ${String(caught)}`);
  assert.match((caught as Error).message, pattern);
  assert.equal((caught as BasetenCallError).name, "BasetenCallError");
  assert.ok(Math.abs((caught as BasetenCallError).costUsd - EXPECTED_COST) < 1e-12);
  assert.ok(
    Number.isFinite((caught as BasetenCallError).latencyMs) &&
      (caught as BasetenCallError).latencyMs >= 0,
  );
  return caught;
}

test("non-JSON answer text throws BasetenCallError carrying the usage cost", async () => {
  const client = harness(usageBody("not json at all"));
  const caught = await expectCostError(client, /^baseten: response text was not JSON: not json at all$/);
  // The step's recordFailedCall path records it on the tracker.
  // The tracker rounds to 4 decimals, so 0.001675 lands as 0.0017.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "meta-models/muse-spark-open-1026", "reason", caught);
  assert.equal(tracker.totals().spikeTotalUsd, 0.0017);
  assert.equal(tracker.records().length, 1);
});

test("no text content throws BasetenCallError carrying the usage cost", async () => {
  const body = JSON.stringify({
    choices: [{ message: {} }],
    usage: { prompt_tokens: 1000, completion_tokens: 100 },
  });
  const caught = await expectCostError(harness(body), /^baseten: response message had no text content$/);
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "meta-models/muse-spark-open-1026", "reason", caught);
  assert.equal(tracker.totals().spikeTotalUsd, 0.0017);
});

test("no choices throws BasetenCallError carrying the usage cost", async () => {
  const body = JSON.stringify({
    choices: [],
    usage: { prompt_tokens: 1000, completion_tokens: 100 },
  });
  await expectCostError(harness(body), /^baseten: response had no choices$/);
});

test("valid JSON still returns the same cost, unchanged", async () => {
  const client = harness(usageBody('{"ok":true}'));
  const res = await client.callSpark(req);
  assert.deepEqual(res.json, { ok: true });
  assert.ok(Math.abs(res.costUsd - EXPECTED_COST) < 1e-12);
});
