/** Cost prompt (prompt 05): a work order with no steps would print an empty WORK STEPS section, yet still spend a cost call pricing materials and a labor rate for trades in no steps, so it must fail fast. Empty materials stay allowed: a labor-only job still has steps to price. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCostPrompt } from "@/lib/pipeline/planPrompts";
import type { CostInput } from "@/lib/pipeline/cost";

const base: CostInput = {
  spaceName: "Sanctuary",
  generatedFrom: "walkthrough",
  inventory: [],
  issues: [],
  materials: [{ item: "paint", qty: "2 gallons" }],
  workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] }],
  region: "Sebring, FL",
  laborBasis: "volunteer",
};

describe("buildCostPrompt empty work order", () => {
  test("prints a single step verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall"/);
  });

  test("rejects an empty work order instead of printing an empty WORK STEPS section", () => {
    assert.throws(
      () => buildCostPrompt({ ...base, workOrder: [] }, "church sanctuary"),
      /buildCostPrompt: workOrder must be non-empty/,
    );
  });

  test("rejects an empty work order even when materials are present", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [
              { item: "paint", qty: "2 gallons" },
              { item: "roller", qty: "1" },
            ],
            workOrder: [],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder must be non-empty/,
    );
  });

  test("still prints when materials are empty but a step exists", () => {
    const prompt = buildCostPrompt({ ...base, materials: [] }, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall"/);
  });
});
