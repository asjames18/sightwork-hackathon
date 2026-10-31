/**
 * formatReasonFilter (offline, pure): a one-line summary of what the
 * reason step's confidence filter did to the model's raw output,
 * logged by runReason only when the filter removed or demoted an
 * issue. It changes no plan output. No network, no model calls.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatReasonFilter,
  type ReasonOutput,
} from "@/lib/pipeline/reason";

type Slim = Pick<ReasonOutput, "issues" | "watch">;

function slim(issues: number, watch?: number): Slim {
  return {
    issues: Array.from({ length: issues }, (_, i) => ({ rank: i + 1 })) as ReasonOutput["issues"],
    ...(watch === undefined ? {} : { watch: Array.from({ length: watch }, () => ({})) as ReasonOutput["watch"] }),
  };
}

describe("formatReasonFilter", () => {
  test("a clean pass keeps everything and drops nothing", () => {
    assert.equal(
      formatReasonFilter(slim(3, 1), slim(3, 1)),
      "reason: filter kept 3 ranked, 1 watch (1 from model, 0 demoted), dropped 0 of 3 raw issues",
    );
  });

  test("a demoted issue grows watch without dropping", () => {
    assert.equal(
      formatReasonFilter(slim(3, 0), slim(2, 1)),
      "reason: filter kept 2 ranked, 1 watch (0 from model, 1 demoted), dropped 0 of 3 raw issues",
    );
  });

  test("a dropped issue shrinks the ranked list", () => {
    assert.equal(
      formatReasonFilter(slim(3, 0), slim(2, 0)),
      "reason: filter kept 2 ranked, 0 watch (0 from model, 0 demoted), dropped 1 of 3 raw issues",
    );
  });

  test("demoted and dropped together, with a model watch entry kept", () => {
    assert.equal(
      formatReasonFilter(slim(4, 1), slim(2, 2)),
      "reason: filter kept 2 ranked, 2 watch (1 from model, 1 demoted), dropped 1 of 4 raw issues",
    );
  });

  test("a missing watch list reads as 0 on both sides", () => {
    assert.equal(
      formatReasonFilter(slim(2), slim(2)),
      "reason: filter kept 2 ranked, 0 watch (0 from model, 0 demoted), dropped 0 of 2 raw issues",
    );
  });
});
