/** Plan-ready tab cue (planReadyCue.ts). A fake document, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cuePlanReady, planReadyTitle } from "@/lib/client/planReadyCue";

function fakeDoc(hidden: boolean, title = "SightWork") {
  const listeners = new Set<() => void>();
  const doc = {
    hidden,
    title,
    addEventListener: (_t: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_t: string, fn: () => void) => void listeners.delete(fn),
    show() {
      doc.hidden = false;
      for (const fn of [...listeners]) fn();
    },
    listeners,
  };
  return doc;
}

test("title names the problem count", () => {
  assert.equal(planReadyTitle(7), "Plan ready: 7 problems · SightWork");
  assert.equal(planReadyTitle(1), "Plan ready: 1 problem · SightWork");
  assert.equal(planReadyTitle(0), "Plan ready: 0 problems · SightWork");
});

test("title without a usable count", () => {
  assert.equal(planReadyTitle(undefined), "Plan ready · SightWork");
  assert.equal(planReadyTitle(Number.NaN), "Plan ready · SightWork");
  assert.equal(planReadyTitle(-2), "Plan ready: 0 problems · SightWork");
});

test("visible tab: no cue, no listener", () => {
  const doc = fakeDoc(false);
  cuePlanReady(5, doc as never);
  assert.equal(doc.title, "SightWork");
  assert.equal(doc.listeners.size, 0);
});

test("hidden tab: cue until the tab is shown, then the old title", () => {
  const doc = fakeDoc(true);
  cuePlanReady(5, doc as never);
  assert.equal(doc.title, "Plan ready: 5 problems · SightWork");
  doc.show();
  assert.equal(doc.title, "SightWork");
  assert.equal(doc.listeners.size, 0);
});

test("cleanup restores the title and is safe twice", () => {
  const doc = fakeDoc(true);
  const stop = cuePlanReady(2, doc as never);
  stop();
  stop();
  assert.equal(doc.title, "SightWork");
  assert.equal(doc.listeners.size, 0);
});

test("a title set by something else is left alone", () => {
  const doc = fakeDoc(true);
  cuePlanReady(2, doc as never);
  doc.title = "Other · SightWork";
  doc.show();
  assert.equal(doc.title, "Other · SightWork");
});

test("no document (server render): nothing happens", () => {
  assert.doesNotThrow(() => cuePlanReady(3, undefined)());
});
