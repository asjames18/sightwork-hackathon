/** Cost prompt (prompt 05): batch web searches so the cost call does not issue one search per material. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCostPrompt } from "@/lib/pipeline/planPrompts";
import type { CostInput } from "@/lib/pipeline/cost";

const input: CostInput = {
  spaceName: "Sanctuary",
  generatedFrom: "walkthrough",
  inventory: [],
  issues: [],
  materials: [
    { item: "paint", qty: "2 gallons" },
    { item: "roller", qty: "1" },
  ],
  workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] }],
  region: "Sebring, FL",
  laborBasis: "volunteer",
};

describe("buildCostPrompt", () => {
  test("asks the model to batch web searches instead of one per item", () => {
    const prompt = buildCostPrompt(input, "church sanctuary");
    assert.match(prompt, /Batch your searches: one search per retailer or material category, not one search per item/);
    assert.match(prompt, /Sebring, FL/);
    assert.match(prompt, /i=0 item="paint"/);
  });
});
