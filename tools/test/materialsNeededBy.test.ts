/** Materials "needed by": the earliest step that uses each material and when it starts. No network. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firstNeededLine, materialsNeededBy, neededByLine } from "@/lib/client/materialsNeededBy";
import type { MaterialItem, WorkStep } from "@/lib/types";

// Fri Oct 30, 2026, evening: the schedule starts Mon Nov 2, 9 AM.
const NOW = new Date(2026, 9, 30, 18, 0, 0);

const steps: WorkStep[] = [
  { order: 1, title: "Make safe", detail: "", fixes: [1], hours: [2, 2] },
  { order: 2, title: "Lights", detail: "", fixes: [2, 3], hours: [4, 4] },
  { order: 3, title: "Carpet", detail: "", fixes: [4], hours: [8, 8] },
];
const materials: MaterialItem[] = [
  { item: "Carpet tile", qty: "20", forIssues: [4] },
  { item: "Cable cover", qty: "2", forIssues: [1] },
  { item: "LED lamp", qty: "6", forIssues: [3, 2] },
  { item: "Gloves", qty: "1 box" },
  { item: "Paint", qty: "1 gal", forIssues: [9] },
];
const plan = { materials, workOrder: steps };

describe("materialsNeededBy", () => {
  it("ties each material to the earliest step that fixes one of its problems", () => {
    const n = materialsNeededBy(plan, NOW);
    assert.deepEqual(n.map((x) => x?.step ?? null), [3, 1, 2, null, null]);
    assert.deepEqual(n[1]!.start, new Date(2026, 10, 2, 9, 0, 0));
    assert.deepEqual(n[2]!.start, new Date(2026, 10, 2, 11, 0, 0));
    // Step 3 is a full day and doesn't fit the rest of Monday, so it starts Tuesday.
    assert.deepEqual(n[0]!.start, new Date(2026, 10, 3, 9, 0, 0));
  });

  it("picks the earlier step when a problem is fixed by more than one step", () => {
    const twice: WorkStep[] = [...steps, { order: 4, title: "Touch up", detail: "", fixes: [1] }];
    assert.equal(materialsNeededBy({ materials: [{ item: "x", qty: "1", forIssues: [1] }], workOrder: twice }, NOW)[0]!.step, 1);
  });

  it("copes with a plan with no steps or no materials", () => {
    assert.deepEqual(materialsNeededBy({ materials, workOrder: [] }, NOW), [null, null, null, null, null]);
    assert.deepEqual(materialsNeededBy({ materials: [], workOrder: steps }, NOW), []);
  });
});

describe("neededByLine", () => {
  it("says the step and its start", () => {
    const n = materialsNeededBy(plan, NOW);
    assert.equal(neededByLine(n[2]), "Needed by step 2, Mon, Nov 2, 11 AM");
    assert.equal(neededByLine(n[0]), "Needed by step 3, Tue, Nov 3, 9 AM");
    assert.equal(neededByLine(null), "");
  });
});

describe("firstNeededLine", () => {
  it("names the earliest still-needed buy", () => {
    const n = materialsNeededBy(plan, NOW);
    assert.equal(firstNeededLine(n), "Buy first: 1 item for step 1, which starts Mon, Nov 2, 9 AM.");
    // Cable cover already in hand: the LED lamps for step 2 come next.
    assert.equal(firstNeededLine(n, [1]), "Buy first: 1 item for step 2, which starts Mon, Nov 2, 11 AM.");
    assert.equal(firstNeededLine(n, [0, 1, 2]), "");
  });

  it("counts items needed at the same time", () => {
    const n = materialsNeededBy({ materials: [...materials, { item: "Tape", qty: "1", forIssues: [1] }], workOrder: steps }, NOW);
    assert.equal(firstNeededLine(n), "Buy first: 2 items for step 1, which starts Mon, Nov 2, 9 AM.");
  });
});
