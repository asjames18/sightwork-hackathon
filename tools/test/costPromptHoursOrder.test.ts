/** Cost prompt (prompt 05): a reversed hours pair prints verbatim as hours=[5, 2], so it must fail fast. */
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

describe("buildCostPrompt work-step hours order", () => {
  test("prints a valid [low, high] pair verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall" trade="volunteer" hours=\[2, 3\]/);
  });

  test("allows an equal pair", () => {
    const prompt = buildCostPrompt(
      { ...base, workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [3, 3] }] },
      "church sanctuary",
    );
    assert.match(prompt, /hours=\[3, 3\]/);
  });

  test("prints unknown when hours are omitted", () => {
    const prompt = buildCostPrompt(
      { ...base, workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer" }] },
      "church sanctuary",
    );
    assert.match(prompt, /hours=unknown/);
  });

  test("rejects a reversed pair instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [5, 2] }] },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.hours must be \[low, high\] with low <= high/,
    );
  });
});
