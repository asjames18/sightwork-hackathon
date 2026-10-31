/**
 * Processing-screen engine labels: with a place on the run, the Planning row names the pricing step's
 * real engine (Muse Spark with web search) and says what it is doing. Offline: labels only.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stepEngines, planningNowLine, PRICING_ENGINE } from "@/lib/client/engines";

describe("stepEngines", () => {
  test("no place: Planning keeps the plan provider's engine", () => {
    assert.equal(stepEngines("baseten").planning, "Muse Spark Open (open weights, on Baseten)");
    assert.equal(stepEngines("meta").planning, "Muse Spark");
    assert.equal(stepEngines("baseten", "  ").planning, "Muse Spark Open (open weights, on Baseten)");
    assert.equal(stepEngines("baseten", null).planning, "Muse Spark Open (open weights, on Baseten)");
  });
  test("with a place: Planning names the web-search pricing engine on either provider", () => {
    assert.equal(stepEngines("baseten", "Atlanta, GA").planning, PRICING_ENGINE);
    assert.equal(stepEngines("meta", "Atlanta, GA").planning, PRICING_ENGINE);
  });
  test("with a place: the other steps are unchanged", () => {
    const a = stepEngines("baseten");
    const b = stepEngines("baseten", "Atlanta, GA");
    for (const k of Object.keys(a) as (keyof typeof a)[]) if (k !== "planning") assert.equal(b[k], a[k], k);
  });
});

describe("planningNowLine", () => {
  test("no place: the ranking line", () => {
    assert.equal(planningNowLine(), "Ranking the problems and putting the work steps in order.");
    assert.equal(planningNowLine(" "), "Ranking the problems and putting the work steps in order.");
  });
  test("with a place: names it and sets the wait", () => {
    const line = planningNowLine(" Atlanta, GA ");
    assert.match(line, /prices for Atlanta, GA,/);
    assert.match(line, /up to a minute/);
  });
});
