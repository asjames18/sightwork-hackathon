/** A Spark call whose response text is not JSON still carries its spend: the parse failure is a MetaCallError with costUsd/latencyMs, so the pipeline step can record the call on the usage tracker before failing the run instead of spending without any usage record. Fake fetch only; nothing leaves the machine. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMetaClient, MetaCallError } from "@/lib/meta/client";

const SCHEMA = { type: "object", properties: {}, required: [] };

/** Fake fetch returning one 200 Responses body. */
function okFetch(body: Record<string, unknown>): typeof fetch {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

function proseBody(usage: Record<string, unknown>): Record<string, unknown> {
  return {
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Fixing your price ranges — gathering retail costs." }],
      },
    ],
    usage,
  };
}

test("prose-not-JSON failure carries token + web_search cost and latency", async () => {
  const client = createMetaClient({ apiKey: "test-key", fetchImpl: okFetch(proseBody({ input_tokens: 1000, output_tokens: 500 })), sleepImpl: async () => {} });
  let caught: unknown;
  try {
    await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA, tools: [{ type: "web_search" }] });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof MetaCallError, "parse failure is a MetaCallError");
  assert.match(caught.message, /response text was not JSON/);
  // 1000 * 1.25 + 500 * 4.25 per million, plus one $0.0025 web search.
  assert.equal(caught.costUsd, 0.00125 + 0.002125 + 0.0025);
  assert.ok(typeof caught.latencyMs === "number" && caught.latencyMs >= 0);
});

test("no-text-output failure carries cost too", async () => {
  const client = createMetaClient({ apiKey: "test-key", fetchImpl: okFetch({ output: [], usage: { input_tokens: 200, output_tokens: 0 } }), sleepImpl: async () => {} });
  let caught: unknown;
  try {
    await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof MetaCallError, "no-text failure is a MetaCallError");
  assert.match(caught.message, /no text output/);
  assert.equal(caught.costUsd, 200 * 1.25 / 1_000_000);
});

test("a good JSON response still returns its cost as before", async () => {
  const client = createMetaClient({ apiKey: "test-key", fetchImpl: okFetch({ output_text: JSON.stringify({ ok: true }), usage: { input_tokens: 100, output_tokens: 100 } }), sleepImpl: async () => {} });
  const res = await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA });
  assert.deepEqual(res.json, { ok: true });
  assert.equal(res.costUsd, (100 * 1.25 + 100 * 4.25) / 1_000_000);
});
