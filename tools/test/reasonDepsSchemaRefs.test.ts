/** Reason step deps.schema shape, validator half: a schema whose $ref
 * cannot be resolved, whose $defs is not an object, or whose $ref is
 * circular used to pass validateReasonRequest (it only checked that
 * the schema was an object) and only fail later, when runReason
 * normalized it with inlineSchemaRefs before the call. The validator
 * now dry-runs that inlining up front, so the same named error fails
 * fast in validate, before any Spark call. A resolvable $ref and
 * schema: {} (the existing test stubs) still pass and reach callSpark.
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
function deps(schema: unknown): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  const base = {
    prompt: "Plan the Sanctuary from 1 frame.",
    schema,
    callSpark: async () => {
      n += 1;
      throw new Error("test: callSpark reached");
    },
    tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
  };
  return { deps: base as unknown as ReasonDeps, calls: () => n };
}

describe("reason step deps.schema $ref must resolve in validateReasonRequest", () => {
  test("an unresolvable $ref throws before any Spark call", async () => {
    const d = deps({ $ref: "#/$defs/missing" });
    assert.throws(() => validateReasonRequest(input(), d.deps), /cannot resolve schema \$ref/);
    await assert.rejects(runReason(input(), d.deps), /cannot resolve schema \$ref/);
    assert.equal(d.calls(), 0);
  });

  test("a circular $ref throws before any Spark call", async () => {
    const d = deps({ $defs: { a: { $ref: "#/$defs/a" } }, $ref: "#/$defs/a" });
    assert.throws(() => validateReasonRequest(input(), d.deps), /circular schema \$ref/);
    await assert.rejects(runReason(input(), d.deps), /circular schema \$ref/);
    assert.equal(d.calls(), 0);
  });

  test("a non-object $defs throws before any Spark call", async () => {
    const d = deps({ $defs: "x", type: "object" });
    assert.throws(() => validateReasonRequest(input(), d.deps), /schema\.\$defs must be an object/);
    await assert.rejects(runReason(input(), d.deps), /schema\.\$defs must be an object/);
    assert.equal(d.calls(), 0);
  });

  test("a resolvable $ref still reaches callSpark", async () => {
    const d = deps({
      $defs: { name: { type: "string" } },
      type: "object",
      properties: { title: { $ref: "#/$defs/name" } },
    });
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });

  test("schema: {} still reaches callSpark, as the existing stubs do", async () => {
    const d = deps({});
    assert.doesNotThrow(() => validateReasonRequest(input(), d.deps));
    await assert.rejects(runReason(input(), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });
});
