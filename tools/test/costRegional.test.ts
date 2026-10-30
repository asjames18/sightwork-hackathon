/** computeCostRange: ungrounded unit prices scaled by the region's state materials factor. Pure math, no calls. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeCostRange, parseCostModel, type CostModelOutput } from "@/lib/pipeline/cost";
import { regionalFactors } from "@/lib/regionalCost";
import type { MaterialItem, WorkStep } from "@/lib/types";

const materials = [
  { item: "Gaffer tape", qty: "2 rolls" },
  { item: "Cable ramp", qty: "1 ramp" },
] as MaterialItem[];
const workOrder: WorkStep[] = [];

function model(grounded: [boolean, boolean]): CostModelOutput {
  return {
    unitCosts: [
      { materialIndex: 0, unit: "roll", unitCost: [10, 20], grounded: grounded[0] },
      { materialIndex: 1, unit: "ramp", unitCost: [0.5, 0.99], grounded: grounded[1] },
    ],
    laborRate: [40, 80],
    contingencyPct: [10, 15],
    assumptions: ["Mid-grade"],
    sources: [],
  };
}

describe("cost: state scaling of ungrounded prices", () => {
  test("ungrounded prices are scaled to cents by the state's materials factor; grounded ones untouched", () => {
    const f = regionalFactors("CA")!;
    assert.ok(f.materials !== 1, "CA factor should move prices");
    const { materials: out, costRange } = computeCostRange(materials, workOrder, "Fresno, CA", "volunteer", model([true, false]));
    assert.deepEqual(out[0].unitCost, [10, 20]);
    assert.deepEqual(out[1].unitCost, [
      Math.round(0.5 * f.materials * 100) / 100,
      Math.round(0.99 * f.materials * 100) / 100,
    ]);
    assert.ok(out[1].unitCost![0] > 0, "a sub-dollar price must not round to zero");
    assert.ok(costRange.assumptions.includes("Ungrounded price for Cable ramp (state-adjusted estimate)"));
    assert.ok(costRange.assumptions.includes(`Adjusted for ${f.stateName} with state averages (estimate)`));
  });

  test("no recognizable state: ungrounded price kept as is and flagged not verified, no adjusted line", () => {
    const { materials: out, costRange } = computeCostRange(materials, workOrder, "Toronto", "volunteer", model([true, false]));
    assert.deepEqual(out[1].unitCost, [0.5, 0.99]);
    assert.ok(costRange.assumptions.includes("Ungrounded price for Cable ramp (not verified)"));
    assert.ok(!costRange.assumptions.some((a) => a.startsWith("Adjusted for")));
  });

  test("all grounded: nothing scaled, no adjusted line", () => {
    const { materials: out, costRange } = computeCostRange(materials, workOrder, "Sebring, FL", "volunteer", model([true, true]));
    assert.deepEqual(out.map((m) => m.unitCost), [[10, 20], [0.5, 0.99]]);
    assert.ok(!costRange.assumptions.some((a) => a.startsWith("Adjusted for") || a.startsWith("Ungrounded")));
  });

  test("totals follow the scaled prices (low <= high, rounded to tens)", () => {
    const { costRange } = computeCostRange(materials, workOrder, "Fresno, CA", "volunteer", model([false, false]));
    assert.ok(costRange.low <= costRange.high);
    assert.equal(costRange.low % 10, 0);
    assert.equal(costRange.high % 10, 0);
    assert.equal(costRange.region, "Fresno, CA");
  });

  test("a null sourceIndex parses as no source (so a null-able schema field is safe)", () => {
    const parsed = parseCostModel({
      ...model([false, false]),
      unitCosts: [{ materialIndex: 0, unit: "roll", unitCost: [10, 20], grounded: false, sourceIndex: null }],
    });
    assert.equal(parsed.unitCosts[0].sourceIndex, undefined);
  });
});
