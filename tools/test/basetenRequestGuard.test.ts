/** Baseten caller request guard (src/lib/meta/baseten.ts): a direct caller
 * bypassing the reason step used to pass a non-object straight
 * through — a null request reading .prompt threw a bare TypeError with
 * no step name. A request that is not an object now throws a named
 * baseten error before any fetch, the same named-error rule the SAM,
 * Image, and transcribe callers follow. A valid request still runs,
 * as before. Pure, no network, no key. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createBasetenClient } from "@/lib/meta/baseten";

type Client = ReturnType<typeof createBasetenClient>;
type Req = Parameters<Client["callSpark"]>[0];

const okBody = JSON.stringify({
  choices: [{ message: { content: '{"ok":true}' } }],
  usage: { prompt_tokens: 1000, completion_tokens: 100 },
});

function harness() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(okBody, { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  const client = createBasetenClient({
    apiKey: "x",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return { client, fetchCalls: () => calls };
}

function validReq(): Req {
  return { model: "ignored", prompt: "compare", schema: { type: "object" } };
}

describe("Baseten caller request guard", () => {
  test("a null request throws a named baseten error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark(null as unknown as Req),
      /baseten: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a string request throws a named baseten error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark("compare" as unknown as Req),
      /baseten: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an array request throws a named baseten error, with no fetch", async () => {
    const { client, fetchCalls } = harness();
    await assert.rejects(
      () => client.callSpark([] as unknown as Req),
      /baseten: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a valid request still runs and returns parsed JSON at token cost", async () => {
    const { client, fetchCalls } = harness();
    const out = await client.callSpark(validReq());
    assert.deepEqual(out.json, { ok: true });
    assert.ok(Math.abs(out.costUsd - (1000 * 1.25 + 100 * 4.25) / 1_000_000) < 1e-12);
    assert.equal(fetchCalls(), 1);
  });
});
