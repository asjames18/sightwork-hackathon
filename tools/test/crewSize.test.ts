import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CREW_SIZE, clampCrewSize, crewSizeLine } from "../../src/lib/client/crewSummary";

test("clampCrewSize keeps a whole number between 1 and the maximum", () => {
  assert.equal(clampCrewSize(0), 1);
  assert.equal(clampCrewSize(-4), 1);
  assert.equal(clampCrewSize(2.4), 2);
  assert.equal(clampCrewSize(99), MAX_CREW_SIZE);
  assert.equal(clampCrewSize(Number.NaN), 1);
  assert.equal(clampCrewSize(Number.POSITIVE_INFINITY), 1);
});

test("crewSizeLine shares the total hours evenly and rounds to half hours", () => {
  assert.equal(crewSizeLine([6, 12], false, 3), "3 people: about 2–4 h each.");
  assert.equal(crewSizeLine([6, 12], false, 2), "2 people: about 3–6 h each, roughly 1 working day.");
  assert.equal(crewSizeLine([5, 7], false, 4), "4 people: about 1.5–2 h each.");
});

test("crewSizeLine for one person names days of work and drops 'each'", () => {
  assert.equal(crewSizeLine([6, 12], false, 1), "1 person: about 6–12 h, roughly 2 working days.");
  assert.equal(crewSizeLine([16, 17], false, 1), "1 person: about 16–17 h, roughly 3 working days.");
});

test("crewSizeLine says 'at least' when some steps had no hours, and a single number when the range is one value", () => {
  assert.equal(crewSizeLine([4, 8], true, 2), "2 people: at least 2–4 h each.");
  assert.equal(crewSizeLine([8, 8], false, 4), "4 people: about 2 h each.");
});

test("crewSizeLine is null with no hours or non-finite hours, and clamps a bad crew size", () => {
  assert.equal(crewSizeLine(null, false, 2), null);
  assert.equal(crewSizeLine([Number.NaN, 4], false, 2), null);
  assert.equal(crewSizeLine([4, 8], false, 0), "1 person: about 4–8 h, roughly 1 working day.");
  assert.equal(crewSizeLine([4, 8], false, 500), `${MAX_CREW_SIZE} people: about 0.5 h each.`);
});
