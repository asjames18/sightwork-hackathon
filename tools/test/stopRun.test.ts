/** Stop control on the processing screen (stopRun.ts). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STOP_RUN_LABEL, stopRunConfirm, stoppedRunNote } from "@/lib/client/stopRun";

test("preview runs stop on the first tap", () => {
  assert.equal(stopRunConfirm(false), null);
});

test("real runs ask once and say what still happens", () => {
  const q = stopRunConfirm(true);
  assert.ok(q);
  assert.match(q!, /^Stop this run\?/);
  assert.match(q!, /may still finish/);
  assert.match(q!, /nothing after it runs/);
  assert.match(q!, /video stays here/);
});

test("label is plain", () => {
  assert.equal(STOP_RUN_LABEL, "Stop this run");
});

test("stopped note names the kept video", () => {
  assert.equal(stoppedRunNote("hope-city-stage.mp4"), "Run stopped. hope-city-stage.mp4 is still here, so you can change the details and start again.");
});

test("stopped note without a name", () => {
  assert.equal(stoppedRunNote("  "), "Run stopped. Your video is still here, so you can change the details and start again.");
});
