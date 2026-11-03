/** planSegmentFrames zoneIds guard (segment step): a direct caller
 * bypassing runSegment's input validation used to get a raw
 * TypeError here — a null zoneIds reading .length — or a
 * misleading named error (a number zoneIds reporting "got
 * undefined" entries, a string zoneIds failing its first entry's
 * zone check). All non-array zoneIds now throw one named segment
 * error, the same named-error rule the sceneFrameIndices check
 * above it follows. Valid inputs are unchanged.
 * Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planSegmentFrames } from "@/lib/pipeline/segment";

type Opts = Parameters<typeof planSegmentFrames>[0];

describe("planSegmentFrames zoneIds guard", () => {
  test("a null zoneIds throws a named segment error", () => {
    assert.throws(
      () => planSegmentFrames({ frameCount: 3, zoneIds: null as unknown as Opts["zoneIds"] }),
      /segment: zoneIds must be an array when given/,
    );
  });

  test("a number zoneIds throws a named segment error", () => {
    assert.throws(
      () => planSegmentFrames({ frameCount: 3, zoneIds: 7 as unknown as Opts["zoneIds"] }),
      /segment: zoneIds must be an array when given/,
    );
  });

  test("a string zoneIds throws a named segment error", () => {
    assert.throws(
      () => planSegmentFrames({ frameCount: 3, zoneIds: "abc" as unknown as Opts["zoneIds"] }),
      /segment: zoneIds must be an array when given/,
    );
  });

  test("a wrong-length zoneIds array still reports its own named error", () => {
    assert.throws(
      () => planSegmentFrames({ frameCount: 10, zoneIds: [0, 0] }),
      /segment: zoneIds must have 10 entries, got 2/,
    );
  });

  test("a valid zoned input still plans the same frames", () => {
    const zoneIds = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
    const plan = planSegmentFrames({ frameCount: 10, zoneIds });
    assert.deepEqual(plan.hazardFrames, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(plan.budgetExceeded, false);
    const zonesCovered = new Set(plan.countFrames.map((f) => zoneIds[f]));
    assert.deepEqual([...zonesCovered].sort(), [0, 1, 2]);
  });
});
