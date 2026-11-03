/** Reason step deps.signal shape: a non-signal handed to runReason
 * throws before any Spark call. Parity with the Meta client, which
 * passes the signal straight to fetch: a string, a number, null, or
 * a plain object used to pass validation and ride onto a paid Spark
 * call that fetch would reject with a bare TypeError — or, for a
 * plain object, never abort at all, since signal.aborted reads
 * undefined and the stop never reaches the in-flight call. A real
 * AbortController signal and an omitted signal still reach callSpark.
 * No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runReason, validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

/** Small JPEG data URL (SOI header, 64 decoded bytes). */
const SMALL = (() => {
  const buf = Buffer.alloc(64);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
})();

function input(): ReasonInput {
  return {
    frames: [{ tSec: 0, dataUrl: SMALL }],
    segmentation: {
      counts: [{ label: "chair", count: 1, confidence: 0.9 }],
      flaggedFrames: [0],
    },
    transcript: null,
    durationSec: 1,
  };
}

/** Deps whose callSpark counts calls and always throws, so no real call can happen. */
function deps(signal: unknown): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  const base = {
    prompt: "Plan the Sanctuary from 1 frame.",
    schema: {},
    callSpark: async () => {
      n += 1;
      throw new Error("test: callSpark reached");
    },
    tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
  };
  return {
    deps: (signal === undefined ? base : { ...base, signal }) as ReasonDeps,
    calls: () => n,
  };
}

describe("reason step deps.signal must be an AbortSignal when given", () => {
  test("a string signal throws before any Spark call", async () => {
    const d = deps("not a signal");
    assert.throws(() => validateReasonRequest(input(), d.deps), /signal must be an AbortSignal/);
    await assert.rejects(runReason(input(), d.deps), /signal must be an AbortSignal/);
    assert.equal(d.calls(), 0);
  });

  test("a plain object without addEventListener throws", async () => {
    const d = deps({ aborted: false });
    assert.throws(() => validateReasonRequest(input(), d.deps), /signal must be an AbortSignal/);
    await assert.rejects(runReason(input(), d.deps), /signal must be an AbortSignal/);
    assert.equal(d.calls(), 0);
  });

  test("a null signal throws, not a bare TypeError", async () => {
    const d = deps(null);
    assert.throws(() => validateReasonRequest(input(), d.deps), /signal must be an AbortSignal/);
    await assert.rejects(runReason(input(), d.deps), /signal must be an AbortSignal/);
    assert.equal(d.calls(), 0);
  });

  test("a real AbortController signal reaches callSpark", async () => {
    const controller = new AbortController();
    const d = deps(controller.signal);
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });

  test("an omitted signal reaches callSpark, as before", async () => {
    const d = deps(undefined);
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });
});
