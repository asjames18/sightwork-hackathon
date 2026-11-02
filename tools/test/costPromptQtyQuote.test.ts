/**
 * buildCostPrompt escapes a double quote in a material qty, instead
 * of printing it verbatim, so the qty="..." field in the materials
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

function withQty(qty: string): string {
  return buildCostPrompt(
    {
      ...base,
      materials: [{ item: "pipe", qty }],
    },
    "church sanctuary",
  );
}

describe("buildCostPrompt double quote in material qty", () => {
  test("escapes a double quote in a material qty", () => {
    const prompt = withQty('2" pipe');
    assert.ok(prompt.includes('qty="2\\" pipe"'));
  });

  test("escapes an inch mark in a material qty", () => {
    const prompt = withQty('1 12" board');
    assert.ok(prompt.includes('qty="1 12\\" board"'));
  });

  test("keeps a clean material qty in the prompt", () => {
    const prompt = withQty("2 gallons");
    assert.match(prompt, /qty="2 gallons"/);
  });

  test("still allows an apostrophe in a material qty", () => {
    const prompt = withQty("2 gallons, painter's");
    assert.ok(prompt.includes("painter's"));
  });

  test("still rejects a newline in a material qty", () => {
    assert.throws(
      () => withQty("a\nb"),
      /buildCostPrompt: materials\[0\]\.qty must not contain a newline/,
    );
  });

  test("still escapes a double quote in a material item", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: '2" pipe', qty: "1" }],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('item="2\\" pipe"'));
  });
});
