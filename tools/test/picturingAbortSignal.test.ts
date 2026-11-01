/**
 * Offline test of the picturing step's abort-signal wiring
 * (src/lib/meta/image.ts, src/lib/pipeline/renderAfter.ts,
 * src/lib/pipeline/runPlan.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight after-image call
 * ran to completion and billed, because no signal reached its
 * fetch, and runRenderAfter swallowed even an abort as a
 * model-failure null, so the run shipped a plan with a silently
 * skipped picture. The image caller now passes its request
 * signal to the fetch and throws AbortError before any fetch
 * when already aborted; runRenderAfter forwards its dep signal
 * to the image and judge callers and rethrows AbortError
 * instead of reporting a model failure; and runPlan hands the
 * route's request signal to the renderAfter deps, matching the
 * reason, cost, and review legs. Fake fetch/callers only; no
 * network, no key, no paid call. Omitting the signal behaves
 * exactly as before at every level.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createImageCaller } from "@/lib/meta/image";
import {
  runRenderAfter,
  type RenderAfterDeps,
} from "@/lib/pipeline/renderAfter";
import {
  createUsageTracker,
  type UsageTracker,
} from "@/lib/pipeline/usage";
import type { WorkPlan } from "@/lib/types";

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const FIRST = jpegDataUrl(64);
const SECOND = jpegDataUrl(128);

/** Base64 of a JPEG header, as a completed image_generation_call result. */
const JPEG_RESULT = "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

function completedBody(): string {
  return JSON.stringify({
    output: [{ type: "image_generation_call", status: "completed", result: JPEG_RESULT }],
  });
}

function okResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

/** 3 frames, hero 0, one visible step fixing the rank-1 issue on frame 0. */
function plan(): WorkPlan {
  return {
    heroFrameIndex: 0,
    frames: Array.from({ length: 3 }, (_, i) => ({ index: i, tSec: i, url: FIRST })),
    issues: [{ rank: 1, frameIndex: 0 }],
    workOrder: [{ order: 1, title: "Repaint the wall", detail: "", fixes: [1] }],
  } as unknown as WorkPlan;
}

/** Deps with the given image caller and tracker, no judge unless given. */
function deps(
  callImage: RenderAfterDeps["callImage"],
  tracker: UsageTracker,
  extra: Partial<RenderAfterDeps> = {},
): RenderAfterDeps {
  return {
    imageModel: "test-image",
    callImage,
    tracker,
    ...extra,
  } as unknown as RenderAfterDeps;
}

function abortError(): Error {
  const err = new Error("image: aborted");
  err.name = "AbortError";
  return err;
}

test("runRenderAfter forwards its dep signal to the image caller", async () => {
  const tracker = createUsageTracker();
  let seen: AbortSignal | undefined = undefined;
  const controller = new AbortController();
  const out = await runRenderAfter(
    { plan: plan(), spaceType: "room" },
    deps(async (req) => {
      seen = req.signal;
      throw new Error("image boom");
    }, tracker, { signal: controller.signal }),
  );
  assert.equal(seen, controller.signal);
  assert.equal(out.skipped, "model-failure");
});

test("runRenderAfter without a signal passes none to the image caller, as before", async () => {
  const tracker = createUsageTracker();
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  await runRenderAfter(
    { plan: plan(), spaceType: "room" },
    deps(async (req) => {
      seenKey = "signal" in req;
      seen = req.signal;
      throw new Error("image boom");
    }, tracker),
  );
  assert.equal(seen, undefined);
  assert.equal(seenKey, true);
});

test("runRenderAfter forwards its dep signal to the judge caller", async () => {
  const tracker = createUsageTracker();
  let seen: AbortSignal | undefined = undefined;
  const controller = new AbortController();
  const out = await runRenderAfter(
    { plan: plan(), spaceType: "room" },
    deps(
      async () => ({ images: [FIRST, SECOND], latencyMs: 1, costUsd: 0.02 }),
      tracker,
      {
        signal: controller.signal,
        generateTwo: true,
        judgeModel: "test-judge",
        callJudge: async (req) => {
          seen = req.signal;
          return { json: { pick: 2 }, latencyMs: 1, costUsd: 0 };
        },
      },
    ),
  );
  assert.equal(seen, controller.signal);
  assert.equal(out.afterImageUrl, FIRST);
});

test("runRenderAfter rethrows an AbortError from the image caller instead of a model failure", async () => {
  const tracker = createUsageTracker();
  let caught: unknown;
  try {
    await runRenderAfter(
      { plan: plan(), spaceType: "room" },
      deps(async () => {
        throw abortError();
      }, tracker),
    );
  } catch (err) {
    caught = err;
  }
  assert.equal((caught as Error).name, "AbortError");
});

test("the image caller throws AbortError before any fetch when already aborted", async () => {
  let fetched = 0;
  const caller = createImageCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl: (async () => {
      fetched += 1;
      return okResponse(completedBody());
    }) as unknown as typeof fetch,
    sleepImpl: async () => {},
  });
  const controller = new AbortController();
  controller.abort();
  let caught: unknown;
  try {
    await caller({ model: "muse-image-1.0", prompt: "p", image: FIRST, signal: controller.signal });
  } catch (err) {
    caught = err;
  }
  assert.equal((caught as Error).name, "AbortError");
  assert.equal(fetched, 0);
});

test("the image caller passes a live signal to the fetch and the call succeeds", async () => {
  let seen: AbortSignal | undefined | null = null;
  const caller = createImageCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl: (async (_url: unknown, init: unknown) => {
      seen = (init as { signal?: AbortSignal }).signal ?? null;
      return okResponse(completedBody());
    }) as unknown as typeof fetch,
    sleepImpl: async () => {},
  });
  const controller = new AbortController();
  const res = await caller({ model: "muse-image-1.0", prompt: "p", image: FIRST, signal: controller.signal });
  assert.equal(res.images.length, 1);
  assert.equal(seen, controller.signal);
});

test("the image caller without a signal leaves the fetch without one, as before", async () => {
  let seen: AbortSignal | undefined = undefined;
  let seenKey = false;
  const caller = createImageCaller({
    apiKey: "test-key",
    baseUrl: "https://example.invalid/v1",
    fetchImpl: (async (_url: unknown, init: unknown) => {
      seenKey = "signal" in (init as Record<string, unknown>);
      seen = (init as { signal?: AbortSignal }).signal;
      return okResponse(completedBody());
    }) as unknown as typeof fetch,
    sleepImpl: async () => {},
  });
  const res = await caller({ model: "muse-image-1.0", prompt: "p", image: FIRST });
  assert.equal(res.images.length, 1);
  assert.equal(seen, undefined);
  assert.equal(seenKey, true);
});
