/** PROTOTYPE state cost index (BEA RPP 2023 goods, BLS OEWS May 2025 construction wages). Pure math, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyRegionalFactors,
  describeFactors,
  regionalFactors,
  STATE_COST_TABLE,
  stateFromRegion,
  US_CONSTRUCTION_WAGE,
  US_GOODS_RPP,
} from "@/lib/regionalCost";

describe("state cost index", () => {
  test("table covers the 50 states and DC with sane values", () => {
    const rows = Object.entries(STATE_COST_TABLE);
    assert.equal(rows.length, 51);
    for (const [code, r] of rows) {
      assert.match(code, /^[A-Z]{2}$/);
      assert.ok(r.goodsRpp >= 90 && r.goodsRpp <= 110, `${code} goods ${r.goodsRpp}`);
      assert.ok(r.constructionWage >= 20 && r.constructionWage <= 50, `${code} wage ${r.constructionWage}`);
    }
  });
  test("pinned published values (BEA Table 2 goods, BLS 47-0000 mean hourly)", () => {
    assert.equal(STATE_COST_TABLE.FL.goodsRpp, 98.4);
    assert.equal(STATE_COST_TABLE.CA.goodsRpp, 107.5);
    assert.equal(STATE_COST_TABLE.FL.constructionWage, 26.71);
    assert.equal(US_GOODS_RPP, 99.5);
    assert.equal(US_CONSTRUCTION_WAGE, 31.42);
  });
  test("factors are state vs US, rounded to 2 places", () => {
    assert.deepEqual(regionalFactors("fl"), { state: "FL", stateName: "Florida", materials: 0.99, labor: 0.85 });
    assert.deepEqual(regionalFactors("CA"), { state: "CA", stateName: "California", materials: 1.08, labor: 1.2 });
    assert.equal(regionalFactors("ZZ"), null);
  });
  test("reads the state from a 'City, ST' region", () => {
    assert.equal(stateFromRegion("Sebring, FL"), "FL");
    assert.equal(stateFromRegion("St. Louis, mo "), "MO");
    assert.equal(stateFromRegion("Sebring"), null);
    assert.equal(stateFromRegion("Paris, ZZ"), null);
    assert.equal(stateFromRegion(undefined), null);
  });
  test("scales US-average materials and labor ranges, whole dollars, low <= high", () => {
    assert.deepEqual(applyRegionalFactors({ materials: [1000, 2000], labor: [800, 400] }, "FL"), {
      materials: [990, 1980],
      labor: [340, 680],
    });
    assert.equal(applyRegionalFactors({ materials: [1, 2], labor: [1, 2] }, "XX"), null);
  });
  test("plain line for the plan", () => {
    assert.equal(describeFactors(regionalFactors("FL")!), "Florida: materials about 0.99x, labor about 0.85x the US average.");
    assert.equal(describeFactors(regionalFactors("CA")!), "California: materials about 1.08x, labor about 1.2x the US average.");
  });
});
