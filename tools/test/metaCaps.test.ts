/** Spend bounds on the Meta callers (Mosheh 3cde733 image n cap, 7a9f99c Spark image cap): over-cap requests throw before any fetch. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createMetaClient } from "@/lib/meta/client";
import { createImageCaller } from "@/lib/meta/image";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

function noFetch(): { fetchImpl: typeof fetch; calls: () => number } {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    throw new Error("test: fetch must not be called");
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => n };
}

describe("meta spend caps", () => {
  test("Spark: 49 images throws before any fetch", async () => {
    const f = noFetch();
    const client = createMetaClient({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      client.callSpark({ model: "muse-spark-1.3", prompt: "p", images: Array(49).fill(JPEG), schema: {} }),
      /at most 48 images/,
    );
    assert.equal(f.calls(), 0);
  });

  test("Spark: 48 images passes the cap and reaches fetch", async () => {
    const f = noFetch();
    const client = createMetaClient({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(
      client.callSpark({ model: "muse-spark-1.3", prompt: "p", images: Array(48).fill(JPEG), schema: {} }),
      (err: Error) => !/at most 48 images/.test(err.message),
    );
    assert.ok(f.calls() >= 1);
  });

  test("Image: n=5 throws before any fetch", async () => {
    const f = noFetch();
    const caller = createImageCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(caller({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 5 }));
    assert.equal(f.calls(), 0);
  });

  test("Image: n=4 passes the cap and reaches fetch", async () => {
    const f = noFetch();
    const caller = createImageCaller({ apiKey: "test-key", fetchImpl: f.fetchImpl, sleepImpl: async () => {} });
    await assert.rejects(caller({ model: "muse-image-1.0", prompt: "p", image: JPEG, n: 4 }));
    assert.ok(f.calls() >= 1);
  });
});
