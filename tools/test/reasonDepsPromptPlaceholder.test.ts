/** Reason step deps.prompt placeholder: a {{...}} token in the prompt
 * handed to runReason throws before any Spark call. Parity with
 * buildReasonPrompt, which never emits a finished prompt carrying an
 * unfilled placeholder (it throws on one after the last fill), and
 * with the ReasonDeps doc, which says the prompt arrives with
 * placeholders already filled. A direct runReason caller passing the
 * raw template, or a partially filled prompt, used to pass validation
 * and ride onto a paid Spark call with literal {{space_name}} /
 * {{transcript}} slots instead of the space, frames, segmentation and
 * narration. A blank prompt keeps its own message, and a clean prompt
 * still reaches callSpark. No network. */
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
function deps(prompt: string): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      prompt,
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

describe("reason step deps.prompt unfilled placeholder", () => {
  test("a raw template prompt throws before any Spark call", async () => {
    const d = deps('Plan the {{space_name}} from {{frame_count}} frames.');
    assert.throws(() => validateReasonRequest(input(), d.deps), /prompt must not contain an unfilled/);
    await assert.rejects(runReason(input(), d.deps), /prompt must not contain an unfilled/);
    assert.equal(d.calls(), 0);
  });

  test("a partially filled prompt with one leftover token throws", async () => {
    const d = deps("Plan the Sanctuary. Transcript: {{transcript}}");
    assert.throws(() => validateReasonRequest(input(), d.deps), /prompt must not contain an unfilled/);
    await assert.rejects(runReason(input(), d.deps), /prompt must not contain an unfilled/);
    assert.equal(d.calls(), 0);
  });

  test("a blank prompt keeps its own message, not the placeholder one", () => {
    const d = deps("   ");
    assert.throws(() => validateReasonRequest(input(), d.deps), /prompt must be a non-empty string/);
    try {
      validateReasonRequest(input(), d.deps);
      assert.fail("expected a blank-prompt error");
    } catch (e) {
      assert.doesNotMatch((e as Error).message, /unfilled/);
    }
  });

  test("a clean finished prompt reaches callSpark", async () => {
    const d = deps("Plan the Sanctuary from 1 frame.");
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });
});
