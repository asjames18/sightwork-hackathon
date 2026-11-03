import test from "node:test";
import assert from "node:assert/strict";
import { DUST_HINT, DUST_LABEL, makesDust } from "../../src/lib/client/dustCheck";

test("steps that cut, sand, grind or hang drywall get the reminder", () => {
  assert.equal(makesDust({ title: "Hang the new ceiling", detail: "Moisture-resistant drywall on the ceiling, then tape and mud." }), true);
  assert.equal(makesDust({ title: "Trim the door", detail: "Cut the new casing to length and nail it up." }), true);
  assert.equal(makesDust({ title: "Smooth the floor", detail: "Sanding the boards by hand." }), true);
  assert.equal(makesDust({ title: "Open the wall", detail: "Saw out the rotted section." }), true);
  assert.equal(makesDust({ title: "Fix the step", detail: "Drill into the concrete and set the anchors." }), true);
  assert.equal(makesDust({ title: "Re-mortar the chimney", detail: "Tuckpoint the loose joints." }), true);
});

test("steps that only shut off a supply or do other work do not", () => {
  assert.equal(makesDust({ title: "Replace the leaking valve", detail: "Shut off the water and swap the corroded valve for a new quarter-turn one." }), false);
  assert.equal(makesDust({ title: "Before you start", detail: "Cut the power at the breaker and the water at the main." }), false);
  assert.equal(makesDust({ title: "Plan the work", detail: "Cut costs by using volunteers and a shortcut through the side door." }), false);
  assert.equal(makesDust({ title: "Prime and paint", detail: "Primer, two coats of paint." }), false);
  assert.equal(makesDust({ title: "", detail: "" }), false);
  assert.equal(makesDust({}), false);
});

test("label and hint are plain words", () => {
  assert.equal(DUST_LABEL, "Eyes and dust mask");
  assert.match(DUST_HINT, /safety glasses/);
});
