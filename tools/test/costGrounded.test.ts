/** computeCostRange: pricedMaterials / groundedPrices counts for the planning note. Pure math, no calls. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeCostRange, type CostModelOutput } from "@/lib/pipeline/cost";
import type { MaterialItem, WorkStep } from "@/lib/types";

const materials = [
  { item: "Paint", qty: "2 gallons" },
  { item: "Roller", qty: "1" },
  { item: "Tape", qty: "1 roll" },
] as MaterialItem[];
const workOrder: WorkStep[] = [];

function model(unitCosts: CostModelOutput["unitCosts"]): CostModelOutput {
  return {
    unitCosts,
    laborRate: [40, 80],
    contingencyPct: [10, 15],
    assumptions: ["Mid-grade"],
    sources: [],
  };
}

describe("cost: price counts", () => {
  test("counts priced materials and grounded prices; ignored out-of-range prices excluded", () => {
    const r = computeCostRange(
      materials,
      workOrder,
      "Sebring, FL",
      "volunteer",
      model([
        { materialIndex: 0, unit: "gallon", unitCost: [10, 20], grounded: true },
        { materialIndex: 1, unit: "each", unitCost: [5, 8], grounded: false },
        { materialIndex: 9, unit: "each", unitCost: [1, 2], grounded: true },
      ]),
    );
    assert.equal(r.pricedMaterials, 2);
    assert.equal(r.groundedPrices, 1);
  });

  test("duplicate price counts once, using the last price's grounded flag", () => {
    const r = computeCostRange(
      materials,
      workOrder,
      "Sebring, FL",
      "volunteer",
      model([
        { materialIndex: 0, unit: "gallon", unitCost: [10, 20], grounded: true },
        { materialIndex: 0, unit: "gallon", unitCost: [11, 21], grounded: false },
      ]),
    );
    assert.equal(r.pricedMaterials, 1);
    assert.equal(r.groundedPrices, 0);
    assert.deepEqual(r.materials[0].unitCost, [11, 21]);
  });

  test("no prices: both counts zero", () => {
    const r = computeCostRange(materials, workOrder, "Sebring, FL", "volunteer", model([]));
    assert.equal(r.pricedMaterials, 0);
    assert.equal(r.groundedPrices, 0);
  });
});
