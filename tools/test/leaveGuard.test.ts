/** Leave-page question while a real run is going (leaveGuard.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardLeave, shouldGuardLeave } from "@/lib/client/leaveGuard";

function fakeWindow() {
  const handlers = new Set<(e: BeforeUnloadEvent) => void>();
  return {
    handlers,
    addEventListener: (_t: "beforeunload", fn: (e: BeforeUnloadEvent) => void) => void handlers.add(fn),
    removeEventListener: (_t: "beforeunload", fn: (e: BeforeUnloadEvent) => void) => void handlers.delete(fn),
  };
}

test("only a real run that is still going is guarded", () => {
  assert.equal(shouldGuardLeave({ realRun: true, failed: false }), true);
  assert.equal(shouldGuardLeave({ realRun: true, failed: true }), false);
  assert.equal(shouldGuardLeave({ realRun: false, failed: false }), false);
  assert.equal(shouldGuardLeave({ realRun: false, failed: true }), false);
});

test("the guard cancels the unload and is removed when the run ends", () => {
  const w = fakeWindow();
  const off = guardLeave(w);
  assert.equal(w.handlers.size, 1);
  let prevented = false;
  const ev = { preventDefault: () => (prevented = true), returnValue: "x" } as unknown as BeforeUnloadEvent;
  [...w.handlers][0](ev);
  assert.equal(prevented, true);
  assert.equal(ev.returnValue, "");
  off();
  assert.equal(w.handlers.size, 0);
});

test("calling the remover twice, or having no window, is harmless", () => {
  const w = fakeWindow();
  const off = guardLeave(w);
  off();
  off();
  assert.equal(w.handlers.size, 0);
  assert.doesNotThrow(() => guardLeave(undefined)());
});
