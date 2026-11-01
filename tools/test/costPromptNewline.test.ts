/**
 * buildCostPrompt rejects a newline (or carriage return) in a material
 * item, qty or note, or in a work step title or trade, instead of
 * printing it verbatim, so one materials/steps line cannot split into
 * two and read as a phantom second entry to the cost model.
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

describe("buildCostPrompt newline fields", () => {
  test("rejects a newline in a material item", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "pa\nint", qty: "2 gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.item must not contain a newline/,
    );
  });

  test("rejects a carriage return in a material qty", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "2\r gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must not contain a newline/,
    );
  });

  test("rejects a newline in a material note", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "paint", qty: "2 gallons", note: "a\nb" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.note must not contain a newline/,
    );
  });

  test("rejects a newline in a work step title", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix\nleak", detail: "Stop the leak", trade: "volunteer", hours: [2, 3] },
              { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.title must not contain a newline/,
    );
  });

  test("rejects a newline in a work step trade", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak", trade: "vol\nunteer", hours: [2, 3] },
              { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.trade must not contain a newline/,
    );
  });

  test("keeps a clean input and an inch mark in an item", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: '2" pipe', qty: "1" }] },
      "church sanctuary",
    );
    assert.match(prompt, /item="2" pipe"/);
  });

  test("still rejects a malformed thousands qty", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "chairs", qty: "12,34 chairs" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty has a malformed thousands group/,
    );
  });
});
