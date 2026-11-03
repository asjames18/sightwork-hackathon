/** formatSegmentBudget malformed-input guard (server log only, cap-bit
 * runs): the sibling diagnostic lines all stay quiet on malformed
 * input, and this one threw on a non-array dropped-labels side (a
 * number, null, or string in .filter) instead of staying quiet.
 * Malformed inputs now return null, the same quiet rule. Valid
 * inputs are unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatSegmentBudget } from "@/lib/pipeline/runPlan";

describe("formatSegmentBudget malformed-input guard", () => {
  test("a number dropped-labels side stays quiet", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, 5 as unknown as string[]),
      null,
    );
  });

  test("a null dropped-labels side stays quiet", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, null as unknown as string[]),
      null,
    );
  });

  test("a string dropped-labels side stays quiet", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, "ladder" as unknown as string[]),
      null,
    );
  });

  test("a valid cap-bit run still names its dropped labels", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, ["ladder", "bucket"]),
      "runPlan: segment: cap bit: 300 SAM requests on 48 frames, 22 flagged, dropped labels: ladder, bucket",
    );
  });

  test("a valid quiet run still stays quiet", () => {
    assert.equal(formatSegmentBudget(48, 120, 22, false, []), null);
  });

  test("non-string label entries are still filtered out, not printed", () => {
    assert.equal(
      formatSegmentBudget(48, 300, 22, true, ["ladder", 42 as unknown as string]),
      "runPlan: segment: cap bit: 300 SAM requests on 48 frames, 22 flagged, dropped labels: ladder",
    );
  });
});
