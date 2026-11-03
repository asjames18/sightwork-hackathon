import test from "node:test";
import assert from "node:assert/strict";
import { HEIGHT_HINT, HEIGHT_LABEL, worksUpHigh } from "../../src/lib/client/workAtHeight";

test("steps that put someone on a ladder, lift, roof or at a ceiling get the reminder", () => {
  assert.equal(worksUpHigh({ title: "Hang the new ceiling", detail: "Moisture-resistant drywall on the ceiling, then tape and mud." }), true);
  assert.equal(worksUpHigh({ title: "Clean the gutters", detail: "Scoop out the leaves and flush the downspout." }), true);
  assert.equal(worksUpHigh({ title: "Swap the stage lights", detail: "Rent a scissor lift and change the fixtures." }), true);
  assert.equal(worksUpHigh({ title: "Patch the roof", detail: "Replace the cracked shingles." }), true);
  assert.equal(worksUpHigh({ title: "Paint the high wall", detail: "Set up a ladder and cut in the top edge first." }), true);
});

test("ground-level steps do not get it", () => {
  assert.equal(worksUpHigh({ title: "Replace the rusty drain lines", detail: "While the ceiling is open, replace the corroded tub drain line above." }), false);
  assert.equal(worksUpHigh({ title: "Replace the leaking valve", detail: "Shut off the water and swap the valve." }), false);
  assert.equal(worksUpHigh({ title: "Prime, paint and trim", detail: "Stain-blocking primer, two coats, and new window trim." }), false);
  assert.equal(worksUpHigh({ title: "Strap or lay down the scaffold frames", detail: "Lay frames flat on dunnage." }), false);
  assert.equal(worksUpHigh({ title: "Lift the old carpet", detail: "Roll it and carry it out." }), false);
  assert.equal(worksUpHigh({ title: "", detail: "" }), false);
  assert.equal(worksUpHigh({}), false);
});

test("label and hint are plain words", () => {
  assert.equal(HEIGHT_LABEL, "Working up high");
  assert.match(HEIGHT_HINT, /second person/);
});
