/** Work-order crew summary: who does which steps, and roughly how long. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { crewSummary, hoursLabel, showCrewSummary, stepsLabel } from "@/lib/client/crewSummary";
import type { WorkStep } from "@/lib/types";

const step = (order: number, trade?: string, hours?: [number, number]): WorkStep => ({ order, title: `s${order}`, detail: "", trade, hours });

test("paid trades first in order of appearance, then volunteers, with summed hours", () => {
  const s = crewSummary([
    step(3, "Plumber", [3, 6]),
    step(1, "Volunteer", [1, 2]),
    step(2, "Plumber", [1, 2]),
    step(4, "Electrician", [0.5, 1]),
    step(5, "Painter or volunteer", [8, 12]),
  ]);
  assert.deepEqual(
    s.rows.map((r) => [r.label, r.paid, r.steps, r.hours]),
    [
      ["Plumber", true, [2, 3], [4, 8]],
      ["Electrician", true, [4], [0.5, 1]],
      ["Volunteers", false, [1, 5], [9, 14]],
    ],
  );
  assert.deepEqual(s.totalHours, [13.5, 23]);
  assert.equal(s.totalPartial, false);
  assert.deepEqual(s.unassigned, []);
});

test("trade names merge case- and space-insensitively and keep the first spelling", () => {
  const s = crewSummary([step(1, "Drywall crew", [8, 12]), step(2, "  drywall   Crew ", [8, 12])]);
  assert.equal(s.rows.length, 1);
  assert.equal(s.rows[0].label, "Drywall crew");
  assert.deepEqual(s.rows[0].hours, [16, 24]);
  assert.equal(crewSummary([step(1, "electrician / AV tech")]).rows[0].label, "Electrician / AV tech");
});

test("missing hours make the range a floor; no hours at all gives null; reversed or bad hours are handled", () => {
  const s = crewSummary([step(1, "Mason", [2, 4]), step(2, "Mason"), step(3, "Roofer"), step(4, "Roofer", [5, 2]), step(5, "Roofer", [Number.NaN, 1])]);
  assert.deepEqual(s.rows[0].hours, [2, 4]);
  assert.equal(s.rows[0].hoursPartial, true);
  assert.deepEqual(s.rows[1].hours, [2, 5]);
  assert.equal(s.rows[1].hoursPartial, true);
  assert.equal(s.totalPartial, true);
  assert.equal(crewSummary([step(1, "Mason")]).rows[0].hours, null);
  assert.equal(crewSummary([]).totalHours, null);
});

test("steps with no trade are listed apart", () => {
  const s = crewSummary([step(2), step(1, "Volunteer", [1, 1]), step(3, "")]);
  assert.deepEqual(s.unassigned, [2, 3]);
  assert.equal(showCrewSummary(s), true);
});

test("labels", () => {
  assert.equal(stepsLabel([3]), "Step 3");
  assert.equal(stepsLabel([1, 4]), "Steps 1 and 4");
  assert.equal(stepsLabel([1, 4, 6]), "Steps 1, 4 and 6");
  assert.equal(hoursLabel([2, 2], false), "about 2 h");
  assert.equal(hoursLabel([3, 6], true), "at least 3–6 h");
  assert.equal(hoursLabel(null, false), null);
});

test("summary hides when everything is one group", () => {
  assert.equal(showCrewSummary(crewSummary([step(1, "Volunteer"), step(2, "volunteers")])), false);
  assert.equal(showCrewSummary(crewSummary([step(1, "Plumber"), step(2, "Volunteer")])), true);
});
