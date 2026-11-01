/** Cost prompt (prompt 05): two work steps sharing one title printed verbatim as title="Fix leak" twice, so the cost model and the step ticks could merge two different fixes; they must fail fast. Each work step has its own title. */
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

describe("buildCostPrompt work order titles", () => {
  test("prints distinct titles verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Fix leak"/);
    assert.match(prompt, /order=2 title="Repaint wall"/);
  });

  test("rejects two steps sharing one title instead of printing it twice", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak" },
              { order: 2, title: "Fix leak", detail: "Fix the other leak" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[1\]\.title must be unique/,
    );
  });

  test("rejects a title that only differs by surrounding whitespace", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak" },
              { order: 2, title: " Fix leak ", detail: "Fix the other leak" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[1\]\.title must be unique/,
    );
  });
});
