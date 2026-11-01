/**
 * Offline test of the segment step's abort-signal wiring
 * (src/lib/meta/sam.ts, src/lib/pipeline/segment.ts,
 * src/lib/pipeline/runPlan.ts). Stopping a run used to stop only
 * before the next pipeline step: the in-flight SAM calls ran to
 * completion and billed, because no signal reached their fetch.
 * The SAM caller now passes its request signal to the fetch and
 * throws AbortError before any fetch when already aborted; the
 * segment step forwards its dep signal to every SAM call; and
 * runPlan hands the route's request signal to the segment deps
 * (it already rethrew aborts from the segment step), matching
 * the transcribe, reason, cost, review, and picturing legs.
 * An aborted call records no spend: recordFailedCall only records
 * errors carrying costUsd/latencyMs, which a plain AbortError
 * does not. Fake fetch/callers only; no network, no key, no
 * paid call. Omitting the signal behaves exactly as before at
 * every level.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createSamSegmentCaller } from "@/lib/meta/sam";
import {
  runSegment,
  type SegmentDeps,
  type SegmentInput,
} from "@/lib/pipeline/segment";
import { createUsageTracker } from "@/lib/pipeline/usage";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("segmentAbortSignal.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

/** data:image/jpeg URL whose decoded payload is a JPEG header plus padding. */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

function input(): SegmentInput {
  return { frames: [{ tSec: 0, dataUrl: SMALL }], concurrency: 1 };
}

function outputBody(outputText: string): string {
  return JSON.stringify({ output_text: outputText });
}

describe("runSegment abort signal", () => {
  test("step forwards a live signal to the SAM caller", async () => {
    const controller = new AbortController();
    const seen: unknown[] = [];
    const deps: SegmentDeps = {
      callSegment: (async (req) => {
        seen.push(req.signal);
        return { instances: [], latencyMs: 10, costUsd: 0.0025 };
      }) as SegmentDeps["callSegment"],
      tracker: createUsageTracker(),
      signal: controller.signal,
    };
    await runSegment(input(), deps);
    assert.ok(seen.length > 0);
    assert.ok(seen.every((s) => s === controller.signal));
  });

  test("step without a signal passes none to the SAM caller", async () => {
    const seen: unknown[] = ["unset"];
    const deps: SegmentDeps = {
      callSegment: (async (req) => {
        seen[0] = req.signal;
        return { instances: [], latencyMs: 10, costUsd: 0.0025 };
      }) as SegmentDeps["callSegment"],
      tracker: createUsageTracker(),
    };
    await runSegment(input(), deps);
    assert.equal(seen[0], undefined);
  });

  test("an aborted SAM call rethrows AbortError and records no spend", async () => {
    const tracker = createUsageTracker();
    const deps: SegmentDeps = {
      callSegment: (async () => {
        const err = new Error("sam: aborted");
        err.name = "AbortError";
        throw err;
      }) as SegmentDeps["callSegment"],
      tracker,
    };
    await assert.rejects(
      () => runSegment(input(), deps),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });
});

describe("SAM caller abort signal", () => {
  test("already-aborted signal never fetches", async () => {
    let fetches = 0;
    const caller = createSamSegmentCaller({
      apiKey: "test-only-dummy-key",
      baseUrl: "https://example.invalid/v1",
      fetchImpl: (async () => {
        fetches++;
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
      sleepImpl: async () => {},
    });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      caller({
        model: "sam-3.1",
        concept: "chair",
        frameIndex: 0,
        dataUrl: SMALL,
        signal: controller.signal,
      }),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
    assert.equal(fetches, 0);
  });

  test("live signal is passed to the fetch", async () => {
    const controller = new AbortController();
    let seen: unknown = "unset";
    const caller = createSamSegmentCaller({
      apiKey: "test-only-dummy-key",
      baseUrl: "https://example.invalid/v1",
      fetchImpl: (async (_url: unknown, init: unknown) => {
        seen = (init as { signal?: unknown }).signal;
        return new Response(
          outputBody("<|box;w=100;h=100;x1=10;y1=20;x2=50;y2=60;c=0.9|>"),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
      sleepImpl: async () => {},
    });
    const res = await caller({
      model: "sam-3.1",
      concept: "chair",
      frameIndex: 0,
      dataUrl: SMALL,
      signal: controller.signal,
    });
    assert.equal(seen, controller.signal);
    assert.equal(res.instances.length, 1);
  });
});
