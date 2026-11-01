/**
 * buildCostPrompt rejects a material qty with a malformed thousands
 * group instead of printing it verbatim, so a qty like "12,34 chairs"
 * cannot silently price as 12 (parseQty reads only the leading digits
 * and drops the rest) and understate the spend.
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

describe("buildCostPrompt material qty malformed thousands group", () => {
  test("prints a valid thousands qty verbatim", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "tile", qty: "1,000 sq ft" }] },
      "church sanctuary",
    );
    assert.match(prompt, /qty="1,000 sq ft"/);
  });

  test("prints a valid millions qty verbatim", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "screws", qty: "1,000,000 screws" }] },
      "church sanctuary",
    );
    assert.match(prompt, /qty="1,000,000 screws"/);
  });

  test("rejects qty 12,34 widgets", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "widgets", qty: "12,34 widgets" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty has a malformed thousands group/,
    );
  });

  test("rejects qty 1,00 chairs", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "chairs", qty: "1,00 chairs" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty has a malformed thousands group/,
    );
  });

  test("rejects qty with a trailing comma", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "chairs", qty: "1, chairs" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty has a malformed thousands group/,
    );
  });

  test("keeps a qty with no leading number", () => {
    const prompt = buildCostPrompt(
      { ...base, materials: [{ item: "paint", qty: "a roll" }] },
      "church sanctuary",
    );
    assert.match(prompt, /qty="a roll"/);
  });

  test("still rejects a zero qty", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "0" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must be greater than zero/,
    );
  });

  test("still rejects a negative qty", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          { ...base, materials: [{ item: "paint", qty: "-2 gallons" }] },
          "church sanctuary",
        ),
      /buildCostPrompt: materials\[0\]\.qty must not be negative/,
    );
  });
});
