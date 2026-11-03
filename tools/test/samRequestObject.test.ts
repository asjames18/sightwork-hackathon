/** SAM caller request guard (src/lib/meta/sam.ts): a direct caller
 * bypassing the segment step used to get a raw TypeError here — a
 * null request reading .model, with no step name. A non-object
 * request now throws a named sam error before any fetch, the same
 * named-error rule the model/concept checks follow. A valid request
 * still runs, and the fake fetch is never called for a bad request.
 * Pure, no network, no key. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSamSegmentCaller } from "@/lib/meta/sam";

type Caller = ReturnType<typeof createSamSegmentCaller>;
type Req = Parameters<Caller>[0];

function harness() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ output_text: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const caller = createSamSegmentCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return { caller, fetchCalls: () => calls };
}

describe("SAM caller request guard", () => {
  test("a null request throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller(null as unknown as Req),
      /sam: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an undefined request throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller(undefined as unknown as Req),
      /sam: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an array request throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller([] as unknown as Req),
      /sam: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a valid request still runs and returns zero instances", async () => {
    const { caller, fetchCalls } = harness();
    const buf = Buffer.alloc(64);
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
    const out = await caller({
      model: "sam-3.1",
      concept: "chair",
      frameIndex: 0,
      dataUrl: "data:image/jpeg;base64," + buf.toString("base64"),
    });
    assert.deepEqual(out.instances, []);
    assert.equal(out.costUsd, 0.0025);
    assert.equal(fetchCalls(), 1);
  });
});
