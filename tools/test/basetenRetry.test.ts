/**
 * Offline test of the Baseten caller's transient gateway retry (src/lib/meta/baseten.ts, 12548e3).
 * A fake fetch plays back canned responses and a fake sleep records the backoff, so nothing here
 * touches the network, waits in real time, or spends money.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBasetenClient } from "@/lib/meta/baseten";

type Canned = { status: number; body: string };

const okBody = JSON.stringify({
  choices: [{ message: { content: '{"ok":true}' } }],
  usage: { prompt_tokens: 1000, completion_tokens: 100 },
});

function harness(responses: Canned[]) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  let i = 0;
  const fetchImpl = (async (url: string) => {
    calls.push(String(url));
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  const client = createBasetenClient({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { client, calls, sleeps };
}

const req = { model: "ignored", prompt: "compare", schema: { type: "object" } };
const gateway504 = { status: 504, body: '{"error":"authentication service request timed out"}' };

test("a 504 then 200 succeeds on the second attempt after a 1 s backoff", async () => {
  const h = harness([gateway504, { status: 200, body: okBody }]);
  const res = await h.client.callSpark(req);
  assert.deepEqual(res.json, { ok: true });
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.sleeps, [1000]);
  // Cost comes only from the successful response's tokens.
  assert.ok(Math.abs(res.costUsd - (1000 * 1.25 + 100 * 4.25) / 1_000_000) < 1e-12);
});

test("three 504s throw the last response after 1 s and 2 s backoff", async () => {
  const h = harness([
    { status: 504, body: "first" },
    { status: 504, body: "second" },
    { status: 504, body: "third" },
  ]);
  await assert.rejects(h.client.callSpark(req), (err: Error) => {
    assert.match(err.message, /^baseten: 504 third$/);
    return true;
  });
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.sleeps, [1000, 2000]);
});

test("a 502 then 200 succeeds, and a 503 then 200 succeeds", async () => {
  for (const status of [502, 503]) {
    const h = harness([{ status, body: "bad gateway" }, { status: 200, body: okBody }]);
    const res = await h.client.callSpark(req);
    assert.deepEqual(res.json, { ok: true }, `status ${status}`);
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.sleeps, [1000]);
  }
});

test("a 504, then a 502, then 200 still succeeds within three attempts", async () => {
  const h = harness([gateway504, { status: 502, body: "x" }, { status: 200, body: okBody }]);
  const res = await h.client.callSpark(req);
  assert.deepEqual(res.json, { ok: true });
  assert.deepEqual(h.sleeps, [1000, 2000]);
});

test("a 401 throws at once with no retry", async () => {
  const h = harness([{ status: 401, body: "unauthorized" }, { status: 200, body: okBody }]);
  await assert.rejects(h.client.callSpark(req), /baseten: 401 unauthorized/);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.sleeps, []);
});

test("a 404 that is not model_not_found throws at once; model_not_found keeps the short backoff", async () => {
  const plain = harness([{ status: 404, body: "no route" }, { status: 200, body: okBody }]);
  await assert.rejects(plain.client.callSpark(req), /baseten: 404 no route/);
  assert.equal(plain.calls.length, 1);

  const model = harness([{ status: 404, body: '{"error":"model_not_found"}' }, { status: 200, body: okBody }]);
  const res = await model.client.callSpark(req);
  assert.deepEqual(res.json, { ok: true });
  assert.deepEqual(model.sleeps, [250]);
});

test("a 500 is not treated as a gateway hiccup and throws at once", async () => {
  const h = harness([{ status: 500, body: "boom" }, { status: 200, body: okBody }]);
  await assert.rejects(h.client.callSpark(req), /baseten: 500 boom/);
  assert.equal(h.calls.length, 1);
});
