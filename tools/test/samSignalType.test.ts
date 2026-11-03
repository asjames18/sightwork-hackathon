/** SAM caller signal guard (src/lib/meta/sam.ts): a direct caller
 * bypassing the segment step used to pass a non-signal straight
 * through — a string or number has no .aborted, so the aborted
 * check passed it and the real fetch threw a bare TypeError with
 * no step name. A present signal that is not signal-like (an
 * object with a boolean aborted) now throws a named sam error
 * before any fetch. A real AbortSignal still runs, and an
 * already-aborted signal still throws AbortError, as before.
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

function validReq(signal?: AbortSignal): Req {
  const buf = Buffer.alloc(64);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return {
    model: "sam-3.1",
    concept: "chair",
    frameIndex: 0,
    dataUrl: "data:image/jpeg;base64," + buf.toString("base64"),
    signal,
  };
}

describe("SAM caller signal guard", () => {
  test("a string signal throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller({ ...validReq(), signal: "yes" as unknown as AbortSignal }),
      /sam: signal must be an AbortSignal/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a number signal throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller({ ...validReq(), signal: 1 as unknown as AbortSignal }),
      /sam: signal must be an AbortSignal/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an object without a boolean aborted throws a named sam error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller({ ...validReq(), signal: {} as unknown as AbortSignal }),
      /sam: signal must be an AbortSignal/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a real AbortSignal still runs and returns zero instances", async () => {
    const { caller, fetchCalls } = harness();
    const out = await caller(validReq(new AbortController().signal));
    assert.deepEqual(out.instances, []);
    assert.equal(out.costUsd, 0.0025);
    assert.equal(fetchCalls(), 1);
  });

  test("an already-aborted signal still throws AbortError, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => caller(validReq(controller.signal)), (err: unknown) => {
      return err instanceof Error && err.name === "AbortError";
    });
    assert.equal(fetchCalls(), 0);
  });
});
