/**
 * buildCostPrompt rejects a material qty starting with a minus sign
 * instead of printing it verbatim, so a listed material cannot price
 * as a credit instead of a need.
 */
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
  workOrder: [
    { order: 1, title: "Fix leak", detail: "Stop the leak", trade: "volunteer", hours: [2, 3] },
    { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
  ],
  region: "Sebring, FL",
  laborBasis: "volunteer",
};

describe("buildCostPrompt material qty starting with a minus sign", () => {
  test("prints a positive qty verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /qty="2 gallons"/);
  });

  test("rejects qty -2 gallons", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "-2 gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must not be negative/,
    );
  });

  test("rejects qty -1", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "-1" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must not be negative/,
    );
  });

  test("keeps a qty with no leading number", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "paint", qty: "a roll" }] },
      "church sanctuary",
    );
    assert.match(prompt, /qty="a roll"/);
  });

  test("still rejects a zero qty", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "0" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must be greater than zero/,
    );
  });
});
