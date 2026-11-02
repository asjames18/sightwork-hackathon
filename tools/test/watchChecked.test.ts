import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { WatchItem } from "../../src/lib/planExtras";
import {
  loadWatchChecked,
  saveWatchChecked,
  toggleWatchChecked,
  watchCheckLabel,
  watchCheckedKey,
  watchCheckedLine,
} from "../../src/lib/client/watchChecked";
import { watchToText } from "../../src/lib/client/watchText";
import { fakeWindow, noWindow } from "./browser-stubs";

const item = (title: string, extra: Partial<WatchItem> = {}) =>
  ({ title, detail: "", frameIndex: 0, frameTimeSec: 0, ...extra }) as WatchItem;

afterEach(() => noWindow());

test("watchCheckedLine: none, some, both, all, one", () => {
  assert.equal(watchCheckedLine(0, 3), "");
  assert.equal(watchCheckedLine(1, 3), "1 of 3 checked in person.");
  assert.equal(watchCheckedLine(2, 2), "Both checked in person.");
  assert.equal(watchCheckedLine(3, 3), "All 3 checked in person.");
  assert.equal(watchCheckedLine(1, 1), "Checked in person.");
  assert.equal(watchCheckedLine(1, 0), "");
});

test("toggleWatchChecked adds and removes, kept sorted; labels follow the state", () => {
  assert.deepEqual(toggleWatchChecked([2], 0), [0, 2]);
  assert.deepEqual(toggleWatchChecked([0, 2], 2), [0]);
  assert.equal(watchCheckLabel(false), "Mark checked");
  assert.equal(watchCheckLabel(true), "Checked");
});

test("checked finds are saved per plan, ignore out-of-range indexes, and clear when empty", () => {
  fakeWindow();
  const plan = { spaceName: "Kitchen", watch: [item("Loose wire"), item("Ladder")] };
  const other = { spaceName: "Kitchen", watch: [item("Loose wire"), item("Cracked tile")] };
  assert.notEqual(watchCheckedKey(plan), watchCheckedKey(other));
  assert.deepEqual(loadWatchChecked(plan), []);
  assert.equal(saveWatchChecked(plan, [1, 0, 1, 7]), true);
  assert.deepEqual(loadWatchChecked(plan), [0, 1]);
  assert.deepEqual(loadWatchChecked(other), []);
  saveWatchChecked(plan, []);
  assert.deepEqual(loadWatchChecked(plan), []);
});

test("without storage, load is empty and save reports failure", () => {
  noWindow();
  const plan = { spaceName: "Hall", watch: [item("Loose wire")] };
  assert.deepEqual(loadWatchChecked(plan), []);
  assert.equal(saveWatchChecked(plan, [0]), false);
});

test("watchToText marks checked finds and says how many are checked", () => {
  const text = watchToText([item("Loose wire", { area: "Hearth", confidence: 0.36 }), item("Ladder in the walkway", { confidence: 0.4 })], {
    spaceName: "Kitchen",
    checked: [1],
  });
  assert.ok(text);
  const lines = text.split("\n");
  assert.equal(lines[2], "1 of 2 checked in person.");
  assert.ok(lines.includes("- Loose wire (Hearth, 36% sure)"));
  assert.ok(lines.includes("- Ladder in the walkway (40% sure) — checked in person"));
  const none = watchToText([item("Loose wire")], { spaceName: "Kitchen" });
  assert.ok(none && !none.includes("checked in person"));
});
