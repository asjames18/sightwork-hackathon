import { test } from "node:test";
import assert from "node:assert/strict";
import { shutOffFirst } from "../../src/lib/client/shutOffFirst";

test("shutOffFirst names the supply to switch off for each live trade", () => {
  assert.equal(shutOffFirst("Electrician")?.label, "Power off first");
  assert.equal(shutOffFirst("HVAC tech")?.label, "Power off first");
  assert.equal(shutOffFirst("Plumber")?.label, "Water off first");
  assert.equal(shutOffFirst("Sprinkler fitter")?.label, "Water off first");
  assert.equal(shutOffFirst("Gas fitter")?.label, "Gas off first");
});

test("gas wins over plumbing when a trade names both", () => {
  assert.equal(shutOffFirst("Plumber or gas fitter")?.label, "Gas off first");
});

test("shutOffFirst stays quiet for finish work, volunteers and empty trades", () => {
  for (const t of ["Painter", "Drywall crew", "Roofer", "Mason", "Volunteer", "volunteers (electrician friend)", "", "   ", undefined]) {
    assert.equal(shutOffFirst(t), null, String(t));
  }
});

test("every note has a short label and a one-sentence hint", () => {
  for (const t of ["Electrician", "Plumber", "Gas fitter"]) {
    const n = shutOffFirst(t)!;
    assert.ok(n.label.length <= 16, n.label);
    assert.match(n.hint, /^Confirm .* before this work starts\.$/);
  }
});
