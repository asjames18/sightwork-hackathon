/** Cost prompt (prompt 05): a step order of 0, a negative, or a fraction prints verbatim as order=0, so it must fail fast (WorkStep order is 1-based). */
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

describe("buildCostPrompt work-step order", () => {
  test("prints a positive integer order verbatim", () => {
    const prompt = buildCostPrompt(base, "church sanctuary");
    assert.match(prompt, /order=1 title="Repaint wall" trade="volunteer" hours=\[2, 3\]/);
  });

  test("rejects order 0 instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 0, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.order must be a positive integer/,
    );
  });

  test("rejects a negative order instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: -1, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.order must be a positive integer/,
    );
  });

  test("rejects a fractional order instead of printing it verbatim", () => {
    assert.throws(
      () =>
        buildCostPrompt(
          {
            ...base,
            workOrder: [{ order: 1.5, title: "Repaint wall", detail: "Prime and repaint", trade: "volunteer" }],
          },
          "church sanctuary",
        ),
      /buildCostPrompt: workOrder\[0\]\.order must be a positive integer/,
    );
  });
});
