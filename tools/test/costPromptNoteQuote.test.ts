/**
 * buildCostPrompt escapes a double quote in a material note, instead
 * of printing it verbatim, so the note="..." field in the materials
 * list cannot be closed early. An inch mark like 2" pipe still builds,
 * as 2\" pipe.
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

describe("buildCostPrompt double quote in material note", () => {
  test("escapes a double quote in a material note", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: "paint", qty: "2 gallons", note: 'say "hi"' }],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('note="say \\"hi\\""'));
  });

  test("escapes an inch mark in a material note", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: "pipe", qty: "1", note: '2" pipe' }],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('note="2\\" pipe"'));
  });

  test("keeps a clean material note in the prompt", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: "paint", qty: "2 gallons", note: "mid-grade" }],
      },
      "church sanctuary",
    );
    assert.match(prompt, /note="mid-grade"/);
  });

  test("still allows an apostrophe in a material note", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        materials: [{ item: "paint", qty: "2 gallons", note: "painter's choice" }],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes("painter's choice"));
  });

  test("still rejects a newline in a material note", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            materials: [{ item: "paint", qty: "2 gallons", note: "a\nb" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.note must not contain a newline/,
    );
  });

  test("still escapes a double quote in a material item", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: '2" pipe', qty: "1" }] },
      "church sanctuary",
    );
    assert.ok(prompt.includes('item="2\\" pipe"'));
  });
});
