import { test } from "node:test";
import assert from "node:assert/strict";
import { failedTakeNote } from "@/lib/client/saveVideo";

test("failedTakeNote: a kept take on a phone points at Photos", () => {
  assert.equal(failedTakeNote(true, true), "Your video is still saved on this phone. Tap Save video to keep it in Photos, then try again.");
});

test("failedTakeNote: a kept take on a computer points at the download", () => {
  assert.equal(failedTakeNote(true, false), "Your video is still saved in this browser. Tap Save video to download it, then try again.");
});

test("failedTakeNote: a picked video (not kept) shows nothing", () => {
  assert.equal(failedTakeNote(false, true), null);
  assert.equal(failedTakeNote(false, false), null);
});
