/**
 * Offline test of the Baseten caller's non-JSON 200 body
 * (src/lib/meta/baseten.ts). A 200 body that is not JSON used to throw
 * a raw SyntaxError from res.json(), surfacing parser internals instead
 * of the caller and the cause. It now throws a plain, named error
 * ("baseten: response was not JSON"). It stays plain on purpose: unlike
 * SAM's flat rate, Baseten bills by token, and the counts live inside
 * the body that failed to parse, so the failure cannot be priced and
 * the step's recordFailedCall records nothing — the same rule as any
 * other unpriceable failure. Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BasetenCallError, createBasetenClient } from "@/lib/meta/baseten";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

function harness(body: string) {
  const fetchImpl = (async () =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  return createBasetenClient({
    apiKey: "test-key-not-a-real-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

const req = { model: "ignored", prompt: "compare", schema: { type: "object" } };

test("non-JSON 200 body throws a named plain error and records no spend", async () => {
  const client = harness("not json at all");
  let caught: unknown;
  try {
    await client.callSpark(req);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof Error, `expected an Error, got ${String(caught)}`);
  assert.ok(!(caught instanceof BasetenCallError), "unpriceable failure must not carry a cost");
  assert.equal((caught as Error).message, "baseten: response was not JSON");
  // The step's recordFailedCall path records nothing for a plain error.
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "meta-models/muse-spark-open-1026", "reason", caught);
  assert.equal(tracker.totals().spikeTotalUsd, 0);
  assert.equal(tracker.records().length, 0);
});

test("valid JSON still returns the same result, unchanged", async () => {
  const client = harness(
    JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 1000, completion_tokens: 100 },
    }),
  );
  const res = await client.callSpark(req);
  assert.deepEqual(res.json, { ok: true });
  assert.ok(Math.abs(res.costUsd - (1000 * 1.25 + 100 * 4.25) / 1_000_000) < 1e-12);
});
