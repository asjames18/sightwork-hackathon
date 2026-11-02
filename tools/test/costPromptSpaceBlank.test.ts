/**
 * buildCostPrompt rejects a spaces-only space type when given,
 * instead of silently falling back to "room" — the caller never
 * learned the type was blank, and the model priced a generic room
 * rather than the space that was filmed. runPlan's own validator
 * already rejects a spaces-only space type when given before any
 * paid call, so a direct buildCostPrompt caller bypassing runPlan
 * gets the same fail-fast here. An empty string still means "not
 * given" (runPlan's convention) and falls back to the default, as
 * does an omitted space type, and a non-blank type still builds.
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

describe("buildCostPrompt space type blank", () => {
  test("rejects a spaces-only space type", () => {
    assert.throws(
      () => buildCostPrompt(base, "   "),
      /buildCostPrompt: spaceType must not be blank when given/,
    );
  });

  test("rejects a whitespace-only space type with a tab", () => {
    assert.throws(
      () => buildCostPrompt(base, " \t "),
      /buildCostPrompt: spaceType must not be blank when given/,
    );
  });

  test("still falls back when the space type is omitted", () => {
    const prompt = buildCostPrompt(base);
    assert.match(prompt, /room/);
  });

  test("still falls back when the space type is an empty string", () => {
    const prompt = buildCostPrompt(base, "");
    assert.match(prompt, /room/);
  });

  test("still builds a clean cost prompt with a non-blank type", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /church sanctuary/);
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });

  test("still rejects a newline in the space type", () => {
    assert.throws(
      () => buildCostPrompt(base, "church\nsanctuary"),
      /buildCostPrompt: spaceType must not contain a newline/,
    );
  });
});
