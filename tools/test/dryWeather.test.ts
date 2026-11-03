import test from "node:test";
import assert from "node:assert/strict";
import { WEATHER_HINT, WEATHER_LABEL, needsDryWeather } from "../../src/lib/client/dryWeather";

test("steps that work on a roof, gutter, fence, deck, driveway or the outside walls get the reminder", () => {
  assert.equal(needsDryWeather({ title: "Clear the gutters", detail: "Scoop the leaves and flush the downspouts." }), true);
  assert.equal(needsDryWeather({ title: "Patch the roof", detail: "Replace the missing shingles over the hall." }), true);
  assert.equal(needsDryWeather({ title: "Repair the fence", detail: "Reset the leaning posts and re-hang the boards." }), true);
  assert.equal(needsDryWeather({ title: "Stain the back deck", detail: "Sand, clean and stain the boards." }), true);
  assert.equal(needsDryWeather({ title: "Fill the driveway cracks", detail: "Clean out each crack and pour in the filler." }), true);
  assert.equal(needsDryWeather({ title: "Paint the exterior trim", detail: "Scrape and paint the door frames." }), true);
  assert.equal(needsDryWeather({ title: "Mulch the beds", detail: "Spread mulch along the front walkway." }), true);
  assert.equal(needsDryWeather({ title: "Fix the ramp", detail: "Re-pour the curb ramp at the entrance." }), true);
});

test("indoor steps, including a stage deck, do not", () => {
  assert.equal(needsDryWeather({ title: "Declutter and deep clean stage deck", detail: "Clear the stage and mop the floor." }), false);
  assert.equal(needsDryWeather({ title: "Replace the leaking valve", detail: "Shut off the water and swap the valve under the sink." }), false);
  assert.equal(needsDryWeather({ title: "Prime, paint and trim", detail: "Two coats on the walls, then the trim." }), false);
  assert.equal(needsDryWeather({ title: "Hang the new ceiling", detail: "Screw drywall to the joists." }), false);
  assert.equal(needsDryWeather({ title: "Check the roof", detail: "" }), false);
  assert.equal(needsDryWeather({ title: "Insulate and close the walls", detail: "Insulate the opened outside wall, then hang drywall on the walls." }), false);
  assert.equal(needsDryWeather({ title: "Find the moisture source", detail: "Check the bath above and the roof line for the leak behind the peeling paint and fix it." }), true);
  assert.equal(needsDryWeather({ title: "Sand the floor", detail: "Do this indoors with the doors closed." }), false);
  assert.equal(needsDryWeather({ title: "", detail: "" }), false);
  assert.equal(needsDryWeather({}), false);
});

test("label and hint are plain words", () => {
  assert.equal(WEATHER_LABEL, "Needs dry weather");
  assert.match(WEATHER_HINT, /dry day/);
});
