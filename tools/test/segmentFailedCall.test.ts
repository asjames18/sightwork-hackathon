/**
 * runSegment records a billed-but-failed SAM call, then rethrows
 * (offline): the pooled hazard and count passes each land a failed
 * call on the tracker before the throw propagates, so the route
 * total counts the spend; a plain throw records nothing, and a
 * tracker throw (spike cap) replaces the call error as a spending
 * stop. Concurrency 1 keeps the pooled order deterministic: the
 * first failing task stops the pool, so exactly one failed call is
 * recorded. No live calls; callSegment is a stub and fetch throws.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  SAM_MODEL,
  runSegment,
  type SegmentDeps,
  type SegmentInput,
} from "@/lib/pipeline/segment";
import { createUsageTracker } from "@/lib/pipeline/usage";

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("segmentFailedCall.test: no network allowed");
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

/** A caller throw that still spent money, like MetaCallError. */
function billedThrow(costUsd: number, latencyMs: number): Error {
  const err = new Error("meta: response text was not JSON");
  Object.assign(err, { costUsd, latencyMs });
  return err;
}

describe("runSegment failed-call spend", () => {
  test("a billed hazard throw is recorded, then rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: SegmentDeps = {
      callSegment: (async () => {
        throw billedThrow(0.15, 200);
      }) as SegmentDeps["callSegment"],
      tracker,
    };
    await assert.rejects(
      () => runSegment(input(), deps),
      { message: "meta: response text was not JSON" },
    );
    assert.equal(tracker.records().length, 1);
    const [rec] = tracker.records();
    assert.equal(rec.model, SAM_MODEL);
    assert.equal(rec.step, "segment");
    assert.equal(rec.costUsd, 0.15);
    assert.equal(rec.latencyMs, 200);
    assert.equal(tracker.totals().spikeTotalUsd, 0.15);
  });

  test("a plain hazard throw records nothing, still rethrown", async () => {
    const tracker = createUsageTracker();
    const deps: SegmentDeps = {
      callSegment: (async () => {
        throw new Error("network down");
      }) as SegmentDeps["callSegment"],
      tracker,
    };
    await assert.rejects(() => runSegment(input(), deps), { message: "network down" });
    assert.equal(tracker.records().length, 0);
    assert.equal(tracker.totals().spikeTotalUsd, 0);
  });

  test("a cap breach on the failed hazard call replaces it as a spending stop", async () => {
    const tracker = createUsageTracker({ spikeCapUsd: 0.01 });
    const deps: SegmentDeps = {
      callSegment: (async () => {
        throw billedThrow(0.15, 200);
      }) as SegmentDeps["callSegment"],
      tracker,
    };
    await assert.rejects(() => runSegment(input(), deps), /spike cap/);
    assert.equal(tracker.records().length, 0);
  });

  test("a billed count throw is recorded after the hazard pass, then rethrown", async () => {
    const tracker = createUsageTracker();
    let calls = 0;
    const deps: SegmentDeps = {
      callSegment: (async () => {
        calls += 1;
        // Hazard pass: 8 unique prompts on the one frame, all succeed.
        if (calls <= 8) return { instances: [], latencyMs: 100, costUsd: 0.1 };
        throw billedThrow(0.15, 200);
      }) as SegmentDeps["callSegment"],
      tracker,
    };
    await assert.rejects(
      () => runSegment(input(), deps),
      { message: "meta: response text was not JSON" },
    );
    // 8 hazard successes plus the one failed count call ("exit sign"
    // is reused, so the count pass starts with a fresh concept).
    assert.equal(tracker.records().length, 9);
    const last = tracker.records()[8];
    assert.equal(last.model, SAM_MODEL);
    assert.equal(last.step, "segment");
    assert.equal(last.costUsd, 0.15);
    assert.equal(tracker.totals().spikeTotalUsd, 0.95);
  });
});
