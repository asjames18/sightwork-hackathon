import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMIT_CHIP_LABEL, tradeMayNeedPermit } from "../../src/lib/client/permitTrade";

test("tradeMayNeedPermit flags licensed building trades", () => {
  for (const t of ["Electrician", "electrical contractor", "Plumber", "Plumber or roofer", "Roofer or plumber", "HVAC tech", "Gas fitter", "Structural engineer", "Sprinkler fitter", "  Electrician  "]) {
    assert.equal(tradeMayNeedPermit(t), true, t);
  }
});

test("tradeMayNeedPermit leaves finish work, volunteers and empty trades alone", () => {
  for (const t of ["Painter or volunteer", "Drywall crew", "Facilities", "Warehouse crew", "Demo crew", "Volunteer", "volunteers (electrician friend)", "", "   ", undefined]) {
    assert.equal(tradeMayNeedPermit(t), false, String(t));
  }
});

test("the chip label stays short and plain", () => {
  assert.equal(PERMIT_CHIP_LABEL, "Permit may apply");
});
