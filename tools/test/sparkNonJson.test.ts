/**
 * Offline test of the Spark caller's non-JSON 200 body
 * (src/lib/meta/client.ts). A 200 body that is not JSON used to
 * throw a raw SyntaxError from res.json(), surfacing parser
 * internals instead of the caller and the cause. It now throws a
 * plain named Error("meta: response was not JSON"). It stays plain
 * on purpose: Spark bills by the usage tokens in the body that
 * failed to parse, so the failure cannot be priced and the step's
 * recordFailedCall records nothing — no spend is invented, the
 * same rule as the ASR caller's unpriceable non-JSON body.
 * Fake fetch only; no network, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMetaClient, MetaCallError } from "@/lib/meta/client";
import { createUsageTracker, recordFailedCall } from "@/lib/pipeline/usage";

const SCHEMA = { type: "object", properties: {}, required: [] };

function harness(body: string) {
  const fetchImpl = (async () =>
    new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  return createMetaClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
}

test("a 200 with a non-JSON body throws a plain named error and records nothing", async () => {
  const client = harness("{not json");
  let caught: unknown;
  try {
    await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA });
  } catch (err) {
    caught = err;
  }
  assert.ok(!(caught instanceof MetaCallError), `expected plain error, got ${String(caught)}`);
  assert.equal((caught as Error).message, "meta: response was not JSON");
  const tracker = createUsageTracker();
  recordFailedCall(tracker, "muse-spark-1.3", "reason", caught);
  assert.equal(tracker.records().length, 0);
  assert.equal(tracker.totals().spikeTotalUsd, 0);
});

test("a 200 with valid JSON still returns its cost as before", async () => {
  const client = harness(
    JSON.stringify({
      output_text: JSON.stringify({ ok: true }),
      usage: { input_tokens: 100, output_tokens: 100 },
    }),
  );
  const res = await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA });
  assert.deepEqual(res.json, { ok: true });
  assert.equal(res.costUsd, (100 * 1.25 + 100 * 4.25) / 1_000_000);
});
