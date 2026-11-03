import { test } from "node:test";
import assert from "node:assert/strict";
import { OLD_MATERIAL_HINT, OLD_MATERIAL_LABEL, disturbsOldMaterial } from "../../src/lib/client/oldMaterialCheck";

test("steps that scrape, sand or strip paint get the check", () => {
  assert.equal(disturbsOldMaterial({ title: "Prep the walls", detail: "Scrape loose paint and sand the edges smooth." }), true);
  assert.equal(disturbsOldMaterial({ title: "Strip paint from the trim", detail: "Work room by room." }), true);
  assert.equal(disturbsOldMaterial({ title: "Repaint and seal stage floor", detail: "Lightly scuff/sand worn areas, then coat." }), true);
});

test("steps that pull out old plaster, tile or insulation get the check", () => {
  assert.equal(disturbsOldMaterial({ title: "Make the ceiling safe", detail: "Finish pulling down loose plaster and lath." }), true);
  assert.equal(disturbsOldMaterial({ title: "Pump out and remove wet material", detail: "Bag wet insulation and tiles, and check for mold." }), true);
  assert.equal(disturbsOldMaterial({ title: "Take up the old floor", detail: "Remove the vinyl tile and the glue under it." }), true);
});

test("new work and unrelated steps stay quiet", () => {
  assert.equal(disturbsOldMaterial({ title: "Insulate and close the walls", detail: "Install batts, then hang drywall." }), false);
  assert.equal(disturbsOldMaterial({ title: "Hang the new ceiling", detail: "Screw the new panels to the joists." }), false);
  assert.equal(disturbsOldMaterial({ title: "Strap the scaffold frames", detail: "Lay them down along the wall." }), false);
  assert.equal(disturbsOldMaterial({ title: "Fill sandbags", detail: "Stack sand bags at the door." }), false);
  assert.equal(disturbsOldMaterial({ title: "Remove the dead tree", detail: "Cut it down and haul it away." }), false);
  assert.equal(disturbsOldMaterial({ title: "", detail: "" }), false);
  assert.equal(disturbsOldMaterial({}), false);
});

test("the label and hint stay short and do not claim a test result", () => {
  assert.ok(OLD_MATERIAL_LABEL.length <= 28, OLD_MATERIAL_LABEL);
  assert.match(OLD_MATERIAL_HINT, /^A building from before about 1980 can hide lead paint or asbestos\./);
  assert.doesNotMatch(OLD_MATERIAL_HINT, /\bis (safe|unsafe|contaminated)\b/);
});
