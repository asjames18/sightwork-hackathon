import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRAST_KEY,
  contrastAttr,
  contrastLabel,
  contrastName,
  contrastStatus,
  loadContrast,
  nextContrast,
  parseContrast,
  saveContrast,
} from "../../src/lib/client/contrast";

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

test("each press flips between normal and high", () => {
  assert.equal(nextContrast("normal"), "high");
  assert.equal(nextContrast("high"), "normal");
});

test("anything unknown reads as normal", () => {
  for (const bad of [undefined, null, "", "max", 1, {}, ["high"]]) assert.equal(parseContrast(bad), "normal");
  assert.equal(parseContrast("high"), "high");
});

test("words and root attribute for each setting", () => {
  assert.equal(contrastLabel("normal"), "Contrast: Normal");
  assert.equal(contrastLabel("high"), "Contrast: High");
  assert.equal(contrastName("high"), "High");
  assert.equal(contrastStatus("high"), "Contrast set to high.");
  assert.equal(contrastStatus("normal"), "Contrast set to normal.");
  assert.equal(contrastAttr("normal"), "", "normal leaves the page alone");
  assert.equal(contrastAttr("high"), "high");
});

test("the choice is kept, and normal clears it", () => {
  const s = fakeStore();
  assert.equal(loadContrast(s), "normal");
  saveContrast("high", s);
  assert.equal(s.m.get(CONTRAST_KEY), "high");
  assert.equal(loadContrast(s), "high");
  saveContrast("normal", s);
  assert.equal(s.m.has(CONTRAST_KEY), false);
  assert.equal(loadContrast(fakeStore({ [CONTRAST_KEY]: "garbage" })), "normal");
});

test("blocked or missing storage never throws", () => {
  const boom = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(loadContrast(boom), "normal");
  assert.doesNotThrow(() => saveContrast("high", boom));
  assert.doesNotThrow(() => saveContrast("normal", boom));
  assert.equal(loadContrast(null), "normal");
  assert.doesNotThrow(() => saveContrast("high", null));
});
