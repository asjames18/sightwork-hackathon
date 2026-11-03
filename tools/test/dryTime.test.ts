import test from "node:test";
import assert from "node:assert/strict";
import { DRY_HINT, DRY_LABEL, needsDryTime } from "../../src/lib/client/dryTime";

test("steps that paint, caulk, grout, patch or seal get the reminder", () => {
  assert.equal(needsDryTime({ title: "Clean, prime and paint the walls", detail: "Scrub the graffiti, spot-prime with stain blocker, then two coats." }), true);
  assert.equal(needsDryTime({ title: "Seal the tub", detail: "Caulk the seam where the tub meets the tile." }), true);
  assert.equal(needsDryTime({ title: "Re-grout the shower", detail: "Rake out the loose joints and grout them." }), true);
  assert.equal(needsDryTime({ title: "Fix the wall", detail: "Patch the holes with joint compound and sand smooth." }), true);
  assert.equal(needsDryTime({ title: "Repair the step", detail: "Pour a concrete patch into the broken corner." }), true);
  assert.equal(needsDryTime({ title: "Finish the deck", detail: "Stain the deck and seal the boards." }), true);
  assert.equal(needsDryTime({ title: "Mark aisles", detail: "Paint yellow lines for aisles and storage zones." }), true);
});

test("steps that only remove or find old material, or do other work, do not", () => {
  assert.equal(needsDryTime({ title: "Remove the old caulk", detail: "Scrape out the failed caulk and wipe the seam." }), false);
  assert.equal(needsDryTime({ title: "Check the walls", detail: "Look at the peeling paint near the door." }), false);
  assert.equal(needsDryTime({ title: "Replace the leaking valve", detail: "Shut off the water and swap the corroded valve for a new quarter-turn one." }), false);
  assert.equal(needsDryTime({ title: "Pump out the floor", detail: "Pump the floor dry and bag wet insulation." }), false);
  assert.equal(needsDryTime({ title: "Deep-clean the carpet", detail: "Vacuum, then hot-water extract the whole floor." }), false);
  assert.equal(needsDryTime({ title: "", detail: "" }), false);
  assert.equal(needsDryTime({}), false);
});

test("label and hint are plain words", () => {
  assert.equal(DRY_LABEL, "Needs time to dry");
  assert.match(DRY_HINT, /product label/);
});
