import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscribeAnswer, withTranscribeCost } from "@/lib/client/apiPlanJob";
import type { WorkPlan } from "@/lib/types";

const plan = (meta?: WorkPlan["meta"]) => ({ issues: [], ...(meta ? { meta } : {}) }) as unknown as WorkPlan;

describe("transcribe answer cost", () => {
  test("a real cost is kept", () => {
    assert.equal(parseTranscribeAnswer({ transcript: "[0] hi", transcriptTurns: [{ startSec: 0, text: "hi" }], costUsd: 0.031 })?.costUsd, 0.031);
  });
  test("missing, zero, negative, NaN, Infinity or text cost reads as 0", () => {
    for (const costUsd of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, "0.5"])
      assert.equal(parseTranscribeAnswer({ transcript: null, transcriptTurns: [], costUsd })?.costUsd, 0, String(costUsd));
  });
});

describe("withTranscribeCost", () => {
  test("adds to the plan's total without float noise", () => {
    assert.equal(withTranscribeCost(plan({ costUsd: 0.1 }), 0.2).meta?.costUsd, 0.3);
  });
  test("keeps the rest of meta", () => {
    const out = withTranscribeCost(plan({ costUsd: 0.5, region: "Atlanta, GA" }), 0.05);
    assert.deepEqual(out.meta, { costUsd: 0.55, region: "Atlanta, GA" });
  });
  test("a zero plan total still gains the transcribe cost", () => {
    assert.equal(withTranscribeCost(plan({ costUsd: 0 }), 0.02).meta?.costUsd, 0.02);
  });
  test("no plan total, or a bad one, is left alone", () => {
    for (const p of [plan(), plan({}), plan({ costUsd: Number.NaN }), plan({ costUsd: -1 })]) {
      const out = withTranscribeCost(p, 0.04);
      assert.equal(out, p);
    }
  });
  test("no transcribe cost returns the same plan", () => {
    const p = plan({ costUsd: 0.4 });
    for (const t of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(withTranscribeCost(p, t), p);
  });
});
