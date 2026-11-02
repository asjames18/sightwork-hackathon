/** Saved take playback: which take is open and the Watch button labels. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { keepOpenTake, nextOpenTake, takeWatchLabels } from "@/lib/client/takePreview";

test("nextOpenTake: opens the tapped take, closes it on a second tap, switches between takes", () => {
  assert.equal(nextOpenTake(null, "a"), "a");
  assert.equal(nextOpenTake("a", "a"), null);
  assert.equal(nextOpenTake("a", "b"), "b");
  assert.equal(nextOpenTake("a", ""), "a");
});

test("keepOpenTake: the open take closes once it leaves the list", () => {
  assert.equal(keepOpenTake("a", ["a", "b"]), "a");
  assert.equal(keepOpenTake("c", ["a", "b"]), null);
  assert.equal(keepOpenTake(null, ["a"]), null);
  assert.equal(keepOpenTake("a", []), null);
});

test("takeWatchLabels: Watch when closed, Close when open, each naming the take", () => {
  assert.deepEqual(takeWatchLabels(false, "walkthrough-1.mp4"), { text: "Watch", aria: "Watch walkthrough-1.mp4 on this device" });
  assert.deepEqual(takeWatchLabels(true, "walkthrough-1.mp4"), { text: "Close", aria: "Close the playback of walkthrough-1.mp4" });
});
