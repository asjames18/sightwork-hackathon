import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEXT_SIZE_KEY,
  loadTextSize,
  nextTextSize,
  parseTextSize,
  saveTextSize,
  textSizeCss,
  textSizeLabel,
  textSizeName,
  textSizePercent,
  textSizeStatus,
} from "../../src/lib/client/textSize";

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

test("each press moves to the next size and wraps back to normal", () => {
  assert.equal(nextTextSize("normal"), "large");
  assert.equal(nextTextSize("large"), "xlarge");
  assert.equal(nextTextSize("xlarge"), "normal");
});

test("anything unknown reads as normal", () => {
  for (const bad of [undefined, null, "", "huge", 3, {}, ["large"]]) assert.equal(parseTextSize(bad), "normal");
  assert.equal(parseTextSize("large"), "large");
  assert.equal(parseTextSize("xlarge"), "xlarge");
});

test("words and root size for each step", () => {
  assert.equal(textSizeLabel("normal"), "Text size: Normal");
  assert.equal(textSizeLabel("xlarge"), "Text size: Extra large");
  assert.equal(textSizeName("large"), "Large");
  assert.equal(textSizeStatus("xlarge"), "Text size set to extra large.");
  assert.equal(textSizeCss("normal"), "", "normal leaves the browser's own size alone");
  assert.equal(textSizeCss("large"), "115%");
  assert.equal(textSizeCss("xlarge"), "130%");
  assert.ok(textSizePercent("large") > textSizePercent("normal") && textSizePercent("xlarge") > textSizePercent("large"));
});

test("the choice is kept, and normal clears it", () => {
  const s = fakeStore();
  assert.equal(loadTextSize(s), "normal");
  saveTextSize("large", s);
  assert.equal(s.m.get(TEXT_SIZE_KEY), "large");
  assert.equal(loadTextSize(s), "large");
  saveTextSize("normal", s);
  assert.equal(s.m.has(TEXT_SIZE_KEY), false);
  assert.equal(loadTextSize(fakeStore({ [TEXT_SIZE_KEY]: "garbage" })), "normal");
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
  assert.equal(loadTextSize(boom), "normal");
  assert.doesNotThrow(() => saveTextSize("large", boom));
  assert.doesNotThrow(() => saveTextSize("normal", boom));
  assert.equal(loadTextSize(null), "normal");
  assert.doesNotThrow(() => saveTextSize("large", null));
});
