import test from "node:test";
import assert from "node:assert/strict";
import { FUMES_HINT, FUMES_LABEL, usesFumeProduct } from "../../src/lib/client/fumesCheck";

test("steps that open paint, primer, finish, glue or epoxy get the reminder", () => {
  assert.equal(usesFumeProduct({ title: "Prime, paint and trim", detail: "Stain-blocking primer, two coats, and new window trim." }), true);
  assert.equal(usesFumeProduct({ title: "Refinish the stage floor", detail: "Sand, then two coats of polyurethane." }), true);
  assert.equal(usesFumeProduct({ title: "Reset the tile", detail: "Set it with construction glue and grout." }), true);
  assert.equal(usesFumeProduct({ title: "Coat the floor", detail: "Clean it, then roll on epoxy." }), true);
  assert.equal(usesFumeProduct({ title: "Stain the deck", detail: "Brush on a sealer." }), true);
  assert.equal(usesFumeProduct({ title: "Wipe the hardware", detail: "Use mineral spirits on the hinges." }), true);
});

test("steps that only mention old paint or stains the plan found do not", () => {
  assert.equal(usesFumeProduct({ title: "Find the moisture source", detail: "Check the bath above and the roof line for the leak behind the peeling paint and fix it." }), false);
  assert.equal(usesFumeProduct({ title: "Check the ceiling", detail: "Look at the water stain and the flaking paint near the vent." }), false);
  assert.equal(usesFumeProduct({ title: "Replace the leaking valve", detail: "Shut off the water and swap the valve." }), false);
  assert.equal(usesFumeProduct({ title: "Make the ceiling safe", detail: "Finish pulling down loose plaster and lath." }), false);
  assert.equal(usesFumeProduct({ title: "", detail: "" }), false);
  assert.equal(usesFumeProduct({}), false);
});

test("label and hint are plain words", () => {
  assert.equal(FUMES_LABEL, "Ventilate while working");
  assert.match(FUMES_HINT, /fresh air/);
});
