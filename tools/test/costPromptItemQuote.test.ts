/**
 * buildCostPrompt escapes a double quote in a material item, instead
 * of printing it verbatim, so the item="..." field in the materials
 * list cannot be closed early. An inch mark like 2" pipe still builds,
 * as 2\" pipe. A note is printed quoted too, but it is not covered
 * by this treatment yet, so a quote there still builds verbatim.
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

describe("buildCostPrompt double quote in material item", () => {
  test("escapes a double quote in a material item", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: 'pa"int', qty: "2 gallons" }] },
      "church sanctuary",
    );
    assert.ok(prompt.includes('item="pa\\"int"'));
  });

  test("keeps a clean material item in the prompt", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /item="paint"/);
  });

  test("still allows an apostrophe in a material item", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "painter's tape", qty: "1 roll" }] },
      "church sanctuary",
    );
    assert.ok(prompt.includes("painter's tape"));
  });

  test("still rejects a newline in a material item", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "pa\nint", qty: "2 gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.item must not contain a newline/,
    );
  });

  test("still allows a double quote in a material note", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: "paint", qty: "2 gallons", note: 'say "hi"' }],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('say "hi"'));
  });

  test("still rejects a newline in the region", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, region: "Sebring,\nFL" },
          "church sanctuary",
        ),
      /buildCostPrompt: region must not contain a newline/,
    );
  });
});
