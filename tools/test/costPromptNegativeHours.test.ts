/** Cost prompt (prompt 05): negative labor hours print verbatim as hours=[-2, 3], so they must fail fast (labor hours are never negative). */
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

describe("buildCostPrompt work-step hours", () => {
  test("prints non-negative hours verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall" trade="volunteer" hours=\[2, 3\]/);
  });

  test("allows zero hours", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [0, 2] }],
      },
      "church sanctuary",
    );
    assert.match(prompt, /hours=\[0, 2\]/);
  });

  test("rejects a negative low hour instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [-2, 3] }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.hours must be >= 0/,
    );
  });

  test("rejects all-negative hours instead of printing them verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [-3, -1] }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.hours must be >= 0/,
    );
  });
});
