/** Cost prompt (prompt 05): a material note prints verbatim, so a non-string note must fail fast. */
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

describe("buildCostPrompt material note", () => {
  test("prints a string note verbatim", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "paint", qty: "2 gallons", note: "mid-grade" }] },
      "church sanctuary",
    );
    assert.match(prompt, /i=0 item="paint" qty="2 gallons" note="mid-grade"/);
  });

  test("prints an empty note when none is given", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /i=0 item="paint" qty="2 gallons" note=""/);
  });

  test("rejects a non-string note instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "paint", qty: "2 gallons", note: 42 as unknown as string }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.note must be a string when given/,
    );
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "paint", qty: "2 gallons", note: { text: "mid-grade" } as unknown as string }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.note must be a string when given/,
    );
  });
});
