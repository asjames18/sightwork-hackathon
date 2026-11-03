/** Reason step deps.signal shape, second half: a two-method fake signal
 * (aborted plus addEventListener, but no removeEventListener) used to
 * pass validation and ride onto a paid Spark call that fetch would
 * then reject with a bare TypeError, since it is not a real
 * AbortSignal. Every real AbortSignal carries removeEventListener too,
 * so the validator now requires all three. A real AbortController
 * signal and an omitted signal still reach callSpark. Duck-typing
 * stops here on purpose: a fake implementing all three methods still
 * reaches callSpark, because an instanceof check would break a signal
 * from another realm. No network. */
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

describe("reason step deps.signal must also carry removeEventListener", () => {
  test("a fake with aborted + addEventListener but no removeEventListener throws", async () => {
    const d = deps({ aborted: false, addEventListener: () => {} });
    assert.throws(() => validateReasonRequest(input(), d.deps), /signal must be an AbortSignal/);
    await assert.rejects(runReason(input(), d.deps), /signal must be an AbortSignal/);
    assert.equal(d.calls(), 0);
  });

  test("a fake with a non-function removeEventListener throws", async () => {
    const d = deps({ aborted: false, addEventListener: () => {}, removeEventListener: "no" });
    assert.throws(() => validateReasonRequest(input(), d.deps), /signal must be an AbortSignal/);
    await assert.rejects(runReason(input(), d.deps), /signal must be an AbortSignal/);
    assert.equal(d.calls(), 0);
  });

  test("a real AbortController signal still reaches callSpark", async () => {
    const controller = new AbortController();
    const d = deps(controller.signal);
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });

  test("a three-method fake reaches callSpark: the documented duck-typing boundary", async () => {
    const d = deps({ aborted: false, addEventListener: () => {}, removeEventListener: () => {} });
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });
});
