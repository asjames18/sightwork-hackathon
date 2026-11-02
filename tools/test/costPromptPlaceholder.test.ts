/**
 * buildCostPrompt rejects a {{placeholder}} token in a free-text field,
 * instead of letting a later fill() pass expand it: fills run in order
 * (space_type, region, labor_basis, materials_list, steps_list), so a
 * {{steps_list}} token in a material item used to print the whole steps
 * list inside that item line, and a {{labor_basis}} token in the region
 * used to print the labor basis there.
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

describe("buildCostPrompt {{placeholder}} in a free-text field", () => {
  test("rejects a {{steps_list}} token in a material item", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "pipe {{steps_list}}", qty: "1" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.item must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{region}} token in a material note", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "paint", qty: "1", note: "near {{region}}" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.note must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{materials_list}} token in a work step title", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix {{materials_list}}", trade: "volunteer", hours: [2, 3] },
              { order: 2, title: "Repaint wall", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.title must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{labor_basis}} token in the region", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, region: "near {{labor_basis}} town" },
          "church sanctuary",
        ),
      /buildCostPrompt: region must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("rejects a {{region}} token in the space type", () => {
    assert.throws(
      () => buildCostPrompt(base, "{{region}}"),
      /buildCostPrompt: spaceType must not contain a \{\{\.\.\.\}\} placeholder/,
    );
  });

  test("still builds a clean cost prompt", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.ok(prompt.includes('item="paint"'));
    assert.ok(prompt.includes("Sebring, FL"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
