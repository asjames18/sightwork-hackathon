/** Cost prompt (prompt 05): an empty trade prints verbatim as trade="", not "unknown", so it must fail fast (omitted trade already prints "unknown"). */
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

describe("buildCostPrompt work-step trade", () => {
  test("prints a non-empty trade verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall" trade="volunteer" hours=\[2, 3\]/);
  });

  test("prints unknown when trade is omitted", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint" }],
      },
      "church sanctuary",
    );
    assert.match(prompt, /trade="unknown"/);
  });

  test("rejects an empty trade instead of printing trade=\"\"", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.trade must be a non-empty string when given/,
    );
  });

  test("rejects a whitespace-only trade instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 1, title: "Repaint wall", detail: "Prime and repaint", trade: "   " }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.trade must be a non-empty string when given/,
    );
  });
});
