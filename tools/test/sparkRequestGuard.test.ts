/** Spark caller request guard (src/lib/meta/client.ts): a direct
 * callSpark caller bypassing the step used to pass a non-object
 * straight through — a null request reading .model threw a bare
 * TypeError with no step name. A request that is not an object now
 * throws a named meta error before any fetch, the same named-error
 * rule the SAM, Image, Baseten, and transcribe callers follow. A
 * valid request still runs, as before. Fake fetch only; no network,
 * no key. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createMetaClient } from "@/lib/meta/client";

type Client = ReturnType<typeof createMetaClient>;
type Req = Parameters<Client["callSpark"]>[0];

const SCHEMA = { type: "object", properties: {}, required: [] };

function harness() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        output_text: JSON.stringify({ ok: true }),
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const client = createMetaClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return { client, fetchCalls: () => calls };
}

describe("Spark caller request guard", () => {
  test("a null request throws a named meta error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark(null as unknown as Req),
      /meta: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an undefined request throws a named meta error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark(undefined as unknown as Req),
      /meta: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a string request throws a named meta error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark("compare" as unknown as Req),
      /meta: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an array request throws a named meta error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark([] as unknown as Req),
      /meta: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a valid request still runs and returns parsed JSON at token cost", async () => {
    const { client, fetchCalls } = harness();
    const out = await client.callSpark({ model: "muse-spark-1.3", prompt: "p", schema: SCHEMA });
    assert.deepEqual(out.json, { ok: true });
    assert.equal(out.costUsd, (100 * 1.25 + 100 * 4.25) / 1_000_000);
    assert.equal(fetchCalls(), 1);
  });
});
