/**
 * buildCostPrompt escapes a double quote in a work step title, instead
 * of printing it verbatim, so the title="..." field in the work steps
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

describe("buildCostPrompt double quote in work step title", () => {
  test("escapes a double quote in a work step title", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 1, title: 'Say "hi" to the crew', detail: "Greet", trade: "volunteer", hours: [1, 2] },
          { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
        ],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('title="Say \\"hi\\" to the crew"'));
  });

  test("escapes an inch mark in a work step title", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 1, title: 'Replace 2" pipe', detail: "Swap the pipe", trade: "plumber", hours: [1, 2] },
          { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
        ],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes('title="Replace 2\\" pipe"'));
  });

  test("keeps a clean work step title in the prompt", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /title="Fix leak"/);
  });

  test("still allows an apostrophe in a work step title", () => {
    const prompt = buildCostPrompt(
      {
        ...base,
        workOrder: [
          { order: 1, title: "Fix the painter's ladder", detail: "Repair", trade: "volunteer", hours: [1, 2] },
          { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
        ],
      },
      "church sanctuary",
    );
    assert.ok(prompt.includes("painter's ladder"));
  });

  test("still rejects a newline in a work step title", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [
              { order: 1, title: "a\nb", detail: "Repair", trade: "volunteer", hours: [1, 2] },
              { order: 2, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer", hours: [2, 3] },
            ],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.title must not contain a newline/,
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
