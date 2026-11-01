/**
 * buildCostPrompt rejects two work steps sharing one title apart from
 * case instead of printing the same fix twice, so the cost model and
 * the step ticks cannot merge two different fixes.
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

describe("buildCostPrompt work step titles ignoring case", () => {
  test("prints distinct titles verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /title="Fix leak"/);
    assert.match(prompt, /title="Repaint wall"/);
  });

  test("rejects two steps sharing one title apart from case", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak", trade: "volunteer", hours: [2, 3] },
              { order: 2, title: "fix leak", detail: "Fix it again", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[1\]\.title must be unique/,
    );
  });

  test("rejects a title that only differs by case and surrounding whitespace", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak", trade: "volunteer", hours: [2, 3] },
              { order: 2, title: " FIX LEAK ", detail: "Fix it again", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[1\]\.title must be unique/,
    );
  });
});
