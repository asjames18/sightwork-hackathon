/** planSegmentFrames entry guards (segment step): a direct caller
 * bypassing runSegment's input validation used to get a raw
 * TypeError here — null opts reading .frameCount, or a non-array
 * sceneFrameIndices that is not iterable — with no step name.
 * Both now throw named segment errors, the same named-error rule
 * the rest of the module follows. Valid inputs are unchanged.
 * Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planSegmentFrames } from "@/lib/pipeline/segment";

type Opts = Parameters<typeof planSegmentFrames>[0];

describe("planSegmentFrames entry guards", () => {
  test("null opts throws a named segment error", () => {
    assert.throws(
      () => planSegmentFrames(null as unknown as Opts),
      /segment: planSegmentFrames opts must be an object/,
    );
  });

  test("an array opts throws a named segment error", () => {
    assert.throws(
      () => planSegmentFrames([] as unknown as Opts),
      /segment: planSegmentFrames opts must be an object/,
    );
  });

  test("a non-array sceneFrameIndices throws a named segment error", () => {
    assert.throws(
      () =>
        planSegmentFrames({
          frameCount: 10,
          sceneFrameIndices: 3 as unknown as number[],
        }),
      /segment: sceneFrameIndices must be an array when given/,
    );
  });

  test("valid inputs still plan the same frames", () => {
    const plan = planSegmentFrames({ frameCount: 10 });
    assert.deepEqual(plan.hazardFrames, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(plan.countFrames, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(plan.droppedLabels, []);
    assert.equal(plan.budgetExceeded, false);
  });

  test("a valid scene list still plans around it", () => {
    const plan = planSegmentFrames({ frameCount: 10, sceneFrameIndices: [2, 7] });
    assert.ok(plan.hazardFrames.includes(2));
    assert.ok(plan.hazardFrames.includes(7));
    assert.equal(plan.budgetExceeded, false);
  });
});
