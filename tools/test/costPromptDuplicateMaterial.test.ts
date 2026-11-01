/**
 * buildCostPrompt rejects two materials sharing one item instead of
 * printing the same item twice, so the cost model cannot price one
 * item as two lines.
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

describe("buildCostPrompt materials items", () => {
  test("prints distinct items verbatim", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [
          { item: "paint", qty: "2 gallons" },
          { item: "primer", qty: "1 gallon" },
        ],
      },
      "church sanctuary",
    );
    assert.match(prompt, /i=0 item="paint" qty="2 gallons"/);
    assert.match(prompt, /i=1 item="primer" qty="1 gallon"/);
  });

  test("rejects two materials sharing one item instead of printing it twice", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [
              { item: "paint", qty: "2 gallons" },
              { item: "paint", qty: "1 gallon" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[1\]\.item must be unique/,
    );
  });

  test("rejects an item that only differs by surrounding whitespace", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [
              { item: "paint", qty: "2 gallons" },
              { item: " paint ", qty: "1 gallon" },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[1\]\.item must be unique/,
    );
  });
});
