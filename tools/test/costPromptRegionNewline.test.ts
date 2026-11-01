/**
 * buildCostPrompt rejects a newline (or carriage return) in the region
 * or the space type, instead of printing it verbatim, so the prompt
 * line that carries the region or space type cannot split into two
 * and read as a phantom line to the cost model.
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

describe("buildCostPrompt newline region and space type", () => {
  test("rejects a newline in the region", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, region: "Sebring,\nFL" },
          "church sanctuary",
        ),
      /buildCostPrompt: region must not contain a newline/,
    );
  });

  test("rejects a carriage return in the region", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, region: "Sebring,\rFL" },
          "church sanctuary",
        ),
      /buildCostPrompt: region must not contain a newline/,
    );
  });

  test("rejects a newline in the space type", () => {
    assert.throws(
      () => buildCostPrompt(base, "church\nsanctuary"),
      /buildCostPrompt: spaceType must not contain a newline/,
    );
  });

  test("rejects a carriage return in the space type", () => {
    assert.throws(
      () => buildCostPrompt(base, "church\rsanctuary"),
      /buildCostPrompt: spaceType must not contain a newline/,
    );
  });

  test("keeps a clean region and space type in the prompt", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /Sebring, FL/);
    assert.match(prompt, /church sanctuary/);
  });

  test("still rejects a newline in a material item", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "pa\nint", qty: "2 gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.item must not contain a newline/,
    );
  });
});
