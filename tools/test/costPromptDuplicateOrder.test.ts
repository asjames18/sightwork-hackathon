/** Cost prompt (prompt 05): two work steps sharing one order print verbatim as order=1 twice, so they must fail fast (each step has its own 1-based order). */
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

describe("buildCostPrompt work-step order uniqueness", () => {
  test("prints distinct orders verbatim", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 1, title: "Fix leak", detail: "Stop the leak", trade: "volunteer", hours: [1, 2] },
          { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "painter", hours: [2, 3] },
        ],
      },
      "church sanctuary",
    );
    assert.match(prompt, /order=1 title="Fix leak"/);
    assert.match(prompt, /order=2 title="Repaint wall"/);
  });

  test("rejects an adjacent duplicate order instead of printing order=1 twice", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak" },
              { order: 1, title: "Repaint wall", detail: "Prime and repaint" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[1\]\.order must be unique/,
    );
  });

  test("rejects a non-adjacent duplicate order and names its index", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "Fix leak", detail: "Stop the leak" },
              { order: 2, title: "Repaint wall", detail: "Prime and repaint" },
              { order: 1, title: "Patch ceiling", detail: "Replace the tile" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[2\]\.order must be unique/,
    );
  });
});
