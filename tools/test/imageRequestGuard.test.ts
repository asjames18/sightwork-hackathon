/** Image caller request guard (src/lib/meta/image.ts): a direct caller
 * bypassing the renderAfter step used to pass a non-object straight
 * through — a null request reading .model threw a bare TypeError with
 * no step name. A request that is not an object now throws a named
 * image error before any fetch, the same named-error rule the SAM
 * caller follows. A valid request still runs, as before.
 * Pure, no network, no key. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createImageCaller } from "@/lib/meta/image";

type Caller = ReturnType<typeof createImageCaller>;
type Req = Parameters<Caller>[0];

function jpegDataUrl(): string {
  const buf = Buffer.alloc(64);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

function harness() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        output: [
          {
            type: "image_generation_call",
            status: "completed",
            result: jpegDataUrl().slice("data:image/jpeg;base64,".length),
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const caller = createImageCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl,
    sleepImpl: async () => {},
  });
  return { caller, fetchCalls: () => calls };
}

function validReq(): Req {
  return { model: "muse-image-1.0", prompt: "fix the wall", image: jpegDataUrl() };
}

describe("Image caller request guard", () => {
  test("a null request throws a named image error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller(null as unknown as Req),
      /image: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a string request throws a named image error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller("fix the wall" as unknown as Req),
      /image: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("an array request throws a named image error, with no fetch", async () => {
    const { caller, fetchCalls } = harness();
    await assert.rejects(
      () => caller([] as unknown as Req),
      /image: request must be an object/,
    );
    assert.equal(fetchCalls(), 0);
  });

  test("a valid request still runs and returns one image", async () => {
    const { caller, fetchCalls } = harness();
    const out = await caller(validReq());
    assert.equal(out.images.length, 1);
    assert.equal(out.costUsd, 0.01);
    assert.equal(fetchCalls(), 1);
  });
});
