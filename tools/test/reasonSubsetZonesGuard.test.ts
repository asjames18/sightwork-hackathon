/** formatReasonSubsetZones malformed-input guard (server log only,
 * capped runs): the sibling subset lines all stay quiet on malformed
 * input, and this one printed garbage instead ("left out: 2.5", or a
 * covered count quietly short by an out-of-range subset member).
 * Malformed inputs now return null, the same quiet rule. Valid
 * inputs are unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReasonSubsetZones } from "@/lib/pipeline/runPlan";

describe("formatReasonSubsetZones malformed-input guard", () => {
  test("a fractional zone id stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, 2.5, 1], [0]), null);
  });

  test("a negative zone id stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, -1, 1], [0]), null);
  });

  test("a subset index outside the take stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, 1], [0, 5]), null);
  });

  test("a negative subset index stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, 1], [-1]), null);
  });

  test("a fractional subset index stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, 1], [1.5]), null);
  });

  test("a non-array subset stays quiet", () => {
    assert.equal(formatReasonSubsetZones([0, 1], "x" as unknown as number[]), null);
  });

  test("a valid take still renders the same coverage line", () => {
    assert.equal(
      formatReasonSubsetZones([0, 0, 1, 1, 2, 2], [0, 2]),
      "runPlan: reason subset: 2/6 frames, zones 2/3 covered, left out: 2",
    );
  });
});
