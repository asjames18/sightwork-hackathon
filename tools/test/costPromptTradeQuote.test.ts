/**
 * buildCostPrompt escapes a double quote in a work step trade, instead
 * of printing it verbatim, so the trade="..." field in the work steps
 * list cannot be closed early.
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

function withTrade(trade: string): string {
  return buildCostPrompt(
    {
      ...base,
      workOrder: [
        { order: 1, title: "Fix leak", detail: "Stop", trade, hours: [1, 2] },
        { order: 2, title: "Repaint wall", detail: "Prime", trade: "volunteer", hours: [2, 3] },
      ],
    },
    "church sanctuary",
  );
}

describe("buildCostPrompt double quote in work step trade", () => {
  test("escapes a double quote in a work step trade", () => {
    const prompt = withTrade('say "hi"');
    assert.ok(prompt.includes('trade="say \\"hi\\""'));
  });

  test("escapes a quoted nickname in a work step trade", () => {
    const prompt = withTrade('electrician "sparky"');
    assert.ok(prompt.includes('trade="electrician \\"sparky\\""'));
  });

  test("keeps a clean work step trade in the prompt", () => {
    const prompt = withTrade("electrician");
    assert.match(prompt, /trade="electrician"/);
  });

  test("still allows an apostrophe in a work step trade", () => {
    const prompt = withTrade("painter's helper");
    assert.ok(prompt.includes("painter's helper"));
  });

  test("still rejects a newline in a work step trade", () => {
    assert.throws(
      () => withTrade("a\nb"),
      /buildCostPrompt: workOrder\[0\]\.trade must not contain a newline/,
    );
  });

  test("still escapes a double quote in a work step title", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 1, title: 'Say "hi"', detail: "Greet", trade: "volunteer", hours: [1, 2] },
          { order: 2, title: "Repaint wall", detail: "Prime", trade: "volunteer", hours: [2, 3] },
        ],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('title="Say \\"hi\\""'));
  });
});
