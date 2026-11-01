/** Note on the take card when a recording stopped on its own (recorder.ts interruptedTakeNote). No network, no browser. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { interruptedTakeNote } from "@/lib/client/recorder";
import { durationRulesFor } from "@/lib/client/duration";

const medium = durationRulesFor("medium"); // aim 60-90 s
const small = durationRulesFor("small"); // aim 30-60 s

test("not interrupted: no note", () => {
  assert.equal(interruptedTakeNote(null, 40, medium), null);
  assert.equal(interruptedTakeNote(undefined, 40, medium), null);
  assert.equal(interruptedTakeNote("other" as never, 40, medium), null);
});

test("left the page with enough recorded: kept and usable", () => {
  assert.equal(
    interruptedTakeNote("hidden", 72.4, medium),
    "Recording stopped when you left the page. We kept the 1:12 you recorded, which is enough to make your plan.",
  );
});

test("camera turned off part way: kept, but short for the size", () => {
  assert.equal(
    interruptedTakeNote("camera-ended", 42, medium),
    "Recording stopped because the camera turned off. We kept the 0:42 you recorded. That's short for a medium space (aim for 60 to 90 seconds), so record again if you missed part of it.",
  );
});

test("the same length is enough for a smaller space", () => {
  assert.match(interruptedTakeNote("hidden", 42, small) ?? "", /which is enough to make your plan\.$/);
});

test("under the shortest take: says it's too short and to record again", () => {
  assert.equal(
    interruptedTakeNote("hidden", 3.2, medium),
    "Recording stopped when you left the page. Only 0:03 was recorded, too short for a plan.",
  );
  assert.match(interruptedTakeNote("hidden", Number.NaN, medium) ?? "", /Only 0:00 was recorded/);
});
