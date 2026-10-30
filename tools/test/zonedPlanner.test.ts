/** planSegmentFrames with zoneIds (finding B fix, 39ae3ab): every zone keeps a count frame. Pure logic, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coverZones, missingZones } from "@/lib/client/zoneCoverage";
import { planSegmentFrames } from "@/lib/pipeline/segment";

/** Finding B's take: zone 0 = frames 0-15, 1 = 16-31, 2 = 32-43, 3 = 44-47. */
const ZONES48: number[] = Array.from({ length: 48 }, (_, i) => (i < 16 ? 0 : i < 32 ? 1 : i < 44 ? 2 : 3));

describe("zoned segment planner", () => {
  test("finding B: with zoneIds the count pass covers every zone, at the same count", () => {
    const plain = planSegmentFrames({ frameCount: 48 });
    const zoned = planSegmentFrames({ frameCount: 48, zoneIds: ZONES48 });
    assert.deepEqual(missingZones(plain.hazardFrames, plain.countFrames, ZONES48), ["3"]);
    assert.deepEqual(missingZones(zoned.hazardFrames, zoned.countFrames, ZONES48), []);
    assert.equal(zoned.countFrames.length, plain.countFrames.length);
    assert.ok(zoned.countFrames.some((i) => i >= 44));
  });

  test("zoneIds change only the count frames, never the hazard pass or the budget", () => {
    const plain = planSegmentFrames({ frameCount: 48 });
    const zoned = planSegmentFrames({ frameCount: 48, zoneIds: ZONES48 });
    assert.deepEqual(zoned.hazardFrames, plain.hazardFrames);
    assert.equal(zoned.requestsPlanned, plain.requestsPlanned);
    assert.deepEqual(zoned.droppedLabels, plain.droppedLabels);
    assert.equal(zoned.budgetExceeded, plain.budgetExceeded);
  });

  test("count frames are sorted, unique and a subset of the hazard frames", () => {
    const zoned = planSegmentFrames({ frameCount: 48, zoneIds: ZONES48 });
    assert.deepEqual(zoned.countFrames, [...new Set(zoned.countFrames)].sort((a, b) => a - b));
    for (const i of zoned.countFrames) assert.ok(zoned.hazardFrames.includes(i));
  });

  test("server picks match the client coverZones rule", () => {
    const zoned = planSegmentFrames({ frameCount: 48, zoneIds: ZONES48 });
    assert.deepEqual(zoned.countFrames, coverZones(zoned.hazardFrames, ZONES48, zoned.countFrames.length));
  });

  test("a single zone or all-unzoned frames plan exactly as an unzoned take", () => {
    const plain = planSegmentFrames({ frameCount: 48 });
    assert.deepEqual(planSegmentFrames({ frameCount: 48, zoneIds: Array(48).fill(2) }), plain);
    assert.deepEqual(planSegmentFrames({ frameCount: 48, zoneIds: Array(48).fill(undefined) }), plain);
  });

  test("bad zoneIds fail fast", () => {
    assert.throws(() => planSegmentFrames({ frameCount: 48, zoneIds: ZONES48.slice(0, 47) }), /zoneIds must have 48 entries/);
    const neg = [...ZONES48];
    neg[5] = -1;
    assert.throws(() => planSegmentFrames({ frameCount: 48, zoneIds: neg }), /frame 5 zoneId/);
    const frac = [...ZONES48];
    frac[7] = 1.5;
    assert.throws(() => planSegmentFrames({ frameCount: 48, zoneIds: frac }), /frame 7 zoneId/);
  });
});
