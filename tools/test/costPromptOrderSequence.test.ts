/** Cost prompt (prompt 05): work-order orders that skip a number or start above 1 printed verbatim as order=2, order=4, so a missing step looked like a real plan with a step missing; they must fail fast. The work order runs 1..N with no gaps. */
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

describe("buildCostPrompt work order sequence", () => {
  test("prints orders 1,2 verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Fix leak"/);
    assert.match(prompt, /order=2 title="Repaint wall"/);
  });

  test("rejects orders starting above 1 instead of printing order=2 first", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, workOrder: [{ order: 2, title: "Repaint wall", detail: "Prime and repaint" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder orders must start at 1 with no gaps/,
    );
  });

  test("rejects a gap instead of printing order=1, order=3", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak" },
              { order: 3, title: "Repaint wall", detail: "Prime and repaint" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder orders must start at 1 with no gaps/,
    );
  });

  test("still prints a contiguous set even when the array lists 2 before 1", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 2, title: "Repaint wall", detail: "Prime and repaint" },
          { order: 1, title: "Fix leak", detail: "Stop the leak" },
        ],
      },
      "church sanctuary",
    );
    assert.match(prompt, /order=2 title="Repaint wall"/);
    assert.match(prompt, /order=1 title="Fix leak"/);
  });
});
