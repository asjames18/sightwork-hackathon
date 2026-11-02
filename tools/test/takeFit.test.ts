/** Saved take length fit against the chosen room size. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { takeFit } from "@/lib/client/takeFit";
import { checkDuration } from "@/lib/client/duration";

test("takeFit: unknown or bad lengths claim nothing", () => {
  assert.equal(takeFit(null, "medium"), null);
  assert.equal(takeFit(undefined, "medium"), null);
  assert.equal(takeFit(0, "medium"), null);
  assert.equal(takeFit(Number.NaN, "medium"), null);
});

test("takeFit: Medium bands (aim 60-90 s, warn past 95 s, max 2 min)", () => {
  assert.equal(takeFit(2, "medium")?.tone, "block");
  assert.equal(takeFit(2, "medium")?.text, "Too short for a plan");
  assert.equal(takeFit(40, "medium")?.text, "Short for Medium (aim 60–90 s)");
  assert.equal(takeFit(75, "medium")?.text, "Good length for Medium");
  assert.equal(takeFit(100, "medium")?.text, "Near the limit for Medium (max 2 min)");
  assert.equal(takeFit(130, "medium")?.text, "Too long for Medium (max 2 min)");
});

test("takeFit: the same take reads differently by room size; unknown size is Medium", () => {
  assert.equal(takeFit(60, "large")?.tone, "short");
  assert.equal(takeFit(130, "large")?.text, "Good length for Large");
  assert.equal(takeFit(130, "xl")?.text, "Short for Extra large (aim 3–5 min)");
  assert.equal(takeFit(70, "small")?.tone, "long");
  assert.equal(takeFit(75, "nope")?.text, "Good length for Medium");
  assert.match(takeFit(75, "large")?.aria ?? "", /large space/);
});

test("takeFit: a take marked Too long or Too short is exactly one the upload check blocks", () => {
  for (const size of ["small", "medium", "large", "xl"]) {
    for (let s = 1; s <= 320; s += 1) {
      const fit = takeFit(s, size);
      const check = checkDuration(s, size);
      assert.equal(fit?.tone === "block", check.kind === "block", `${size} ${s}s`);
      assert.equal(fit?.tone === "long", check.kind === "warn", `${size} ${s}s`);
    }
  }
});
