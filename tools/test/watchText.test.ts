import { test } from "node:test";
import assert from "node:assert/strict";
import type { WatchItem } from "../../src/lib/planExtras";
import { sendWatchLabel, watchShareTitle, watchToText } from "../../src/lib/client/watchText";
import { SHARE_SIGNOFF } from "../../src/lib/client/planText";

const item = (title: string, extra: Partial<WatchItem> = {}) =>
  ({ title, detail: "", frameIndex: 0, frameTimeSec: 0, ...extra }) as WatchItem;

test("sendWatchLabel: one or many", () => {
  assert.equal(sendWatchLabel(1), "Send this to check");
  assert.equal(sendWatchLabel(2), "Send these to check");
});

test("watchShareTitle: heading with the space when there is one", () => {
  assert.equal(watchShareTitle("  Main   sanctuary "), "Worth a closer look: Main sanctuary");
  assert.equal(watchShareTitle(""), "Worth a closer look");
  assert.equal(watchShareTitle(undefined), "Worth a closer look");
});

test("watchToText: one line per find, what to check under it, sign-off last", () => {
  const text = watchToText(
    [
      item("Loose wire on the floor", { area: "Hearth", confidence: 0.36, detail: "Check whether it is   old or live wiring." }),
      item("Ladder left in the walkway", { confidence: 0.4 }),
    ],
    { spaceName: "Kitchen" },
  );
  assert.equal(
    text,
    [
      "Worth a closer look · Kitchen",
      "2 lower-confidence finds to check in person. Not in the ranked problems or the work order.",
      "- Loose wire on the floor (Hearth, 36% sure)",
      "  Check whether it is old or live wiring.",
      "- Ladder left in the walkway (40% sure)",
      "",
      SHARE_SIGNOFF,
    ].join("\n"),
  );
});

test("watchToText: single find, no space name", () => {
  const text = watchToText([item("Exit sign may be unlit")]) ?? "";
  const lines = text.split("\n");
  assert.equal(lines[0], "Worth a closer look");
  assert.equal(lines[1], "1 lower-confidence find to check in person. Not in the ranked problems or the work order.");
  assert.equal(lines[2], "- Exit sign may be unlit");
});

test("watchToText: an example plan says so first", () => {
  const text = watchToText([item("Exit sign may be unlit")], { sample: true }) ?? "";
  assert.equal(text.split("\n")[0], "Example plan, not a real inspection.");
});

test("watchToText: nothing to send gives null", () => {
  assert.equal(watchToText([]), null);
  assert.equal(watchToText([item("   ")]), null);
});
