/** Reason step segmentation placeholder catch-all: a {{...}} token in
 * any part of the segmentation JSON the per-field guards do not cover
 * (an extra field on a counts entry, or an extra top-level field)
 * throws before any Spark call. Parity with buildReasonPrompt, which
 * prints the whole segmentation object verbatim as JSON: such a token
 * would otherwise be expanded by the later transcript fill, printing
 * the whole transcript inside the SEGMENTATION section. A label token
 * keeps its label message, and a malformed flagged frame keeps its own
 * message, because this check sits after both. No network. */
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
function deps(): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      prompt: "p",
      schema: {},
      callSpark: async () => {
        n += 1;
        throw new Error("test: callSpark reached");
      },
      tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
    },
    calls: () => n,
  };
}

describe("reason step segmentation placeholder catch-all", () => {
  test("an extra top-level field with a token throws before any Spark call", async () => {
    const inp = input();
    (inp.segmentation as unknown as Record<string, unknown>).note = "see {{transcript}}";
    const d = deps();
    assert.throws(() => validateReasonRequest(inp, d.deps), /segmentation must not contain/);
    await assert.rejects(runReason(inp, d.deps), /segmentation must not contain/);
    assert.equal(d.calls(), 0);
  });

  test("an extra field on a counts entry with a token throws before any Spark call", async () => {
    const inp = input();
    (inp.segmentation!.counts[0] as unknown as Record<string, unknown>).zone = "stage {{transcript}}";
    const d = deps();
    assert.throws(() => validateReasonRequest(inp, d.deps), /segmentation must not contain/);
    await assert.rejects(runReason(inp, d.deps), /segmentation must not contain/);
    assert.equal(d.calls(), 0);
  });

  test("a label token keeps its label message, not the catch-all", () => {
    const inp = input();
    inp.segmentation!.counts[0].label = "chair {{transcript}}";
    const d = deps();
    assert.throws(
      () => validateReasonRequest(inp, d.deps),
      /segmentation\.counts\[0\]\.label must not contain/,
    );
    try {
      validateReasonRequest(inp, d.deps);
      assert.fail("expected a label error");
    } catch (e) {
      assert.match((e as Error).message, /counts\[0\]\.label/);
      assert.doesNotMatch((e as Error).message, /^reason: segmentation must not contain/);
    }
  });

  test("a malformed flagged frame keeps its own message over the catch-all", () => {
    const inp = input();
    inp.segmentation!.flaggedFrames = [1.5];
    (inp.segmentation as unknown as Record<string, unknown>).note = "see {{transcript}}";
    const d = deps();
    assert.throws(() => validateReasonRequest(inp, d.deps), /flaggedFrames must be an array of integers/);
  });

  test("a clean segmentation with a token-free extra field passes validation", () => {
    const inp = input();
    (inp.segmentation as unknown as Record<string, unknown>).note = "from zone A";
    const d = deps();
    assert.doesNotThrow(() => validateReasonRequest(inp, d.deps));
  });

  test("a clean segmentation reaches callSpark", async () => {
    const d = deps();
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });
});
