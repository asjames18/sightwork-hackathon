/** formatReasonSubsetZones (server log only, capped runs): reports how many of a take's zones the reason subset covers, and names any zone left out, so a real Large/XL run shows whether the reason step saw every area. Pure, no network, no plan output. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetZones } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetZones", () => {
  test("all zones covered reports no left-out part", () => {
    assert.equal(
      formatReasonSubsetZones([0, 0, 1, 1, 2, 2], [0, 2, 4]),
      "runPlan: reason subset: 3/6 frames, zones 3/3 covered",
    );
  });

  test("one zone left out is named", () => {
    assert.equal(
      formatReasonSubsetZones([0, 0, 1, 1, 2, 2], [0, 2]),
      "runPlan: reason subset: 2/6 frames, zones 2/3 covered, left out: 2",
    );
  });

  test("no zoneIds at all stays quiet", () => {
    assert.equal(formatReasonSubsetZones([undefined, undefined], [0]), null);
  });

  test("unzoned subset frames do not count as a zone", () => {
    assert.equal(
      formatReasonSubsetZones([0, undefined, 1, 2], [0, 1]),
      "runPlan: reason subset: 2/4 frames, zones 1/3 covered, left out: 1, 2",
    );
  });

  test("multiple left-out zones sort ascending", () => {
    assert.equal(
      formatReasonSubsetZones([2, 2, 0, 0, 1], [0, 2]),
      "runPlan: reason subset: 2/5 frames, zones 2/3 covered, left out: 1",
    );
  });
});
