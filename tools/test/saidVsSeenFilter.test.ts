/** "Show only what you didn't mention" toggle on the said-vs-saw rows (saidVsSeenFilter.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canFilterUnmentioned, hiddenSaidRowsLine, showSaidVsSeenRow, unmentionedCount, unmentionedToggleLabel } from "@/lib/client/saidVsSeenFilter";

const seen = { summary: "Cracked tile", frameIndex: 0 };
const matched = { status: "mentioned", seen } as never;
const unmentioned = { status: "unmentioned", seen } as never;
const notSeen = { status: "mentioned_not_seen", seen: null } as never;

test("counts unmentioned rows and ignores bad input", () => {
  assert.equal(unmentionedCount([matched, unmentioned, unmentioned, notSeen]), 2);
  assert.equal(unmentionedCount([]), 0);
  assert.equal(unmentionedCount(null), 0);
  assert.equal(unmentionedCount(undefined), 0);
});

test("offers the toggle only when there are both kinds of rows", () => {
  assert.equal(canFilterUnmentioned([matched, unmentioned]), true);
  assert.equal(canFilterUnmentioned([notSeen, unmentioned]), true);
  assert.equal(canFilterUnmentioned([unmentioned, unmentioned]), false);
  assert.equal(canFilterUnmentioned([matched, notSeen]), false);
  assert.equal(canFilterUnmentioned([]), false);
  assert.equal(canFilterUnmentioned(null), false);
});

test("filter keeps only unmentioned rows; off keeps every row", () => {
  assert.equal(showSaidVsSeenRow(unmentioned, true), true);
  assert.equal(showSaidVsSeenRow(matched, true), false);
  assert.equal(showSaidVsSeenRow(notSeen, true), false);
  assert.equal(showSaidVsSeenRow(matched, false), true);
  assert.equal(showSaidVsSeenRow(notSeen, false), true);
});

test("labels the button and the hidden-rows line", () => {
  const rows = [matched, unmentioned, unmentioned, notSeen];
  assert.equal(unmentionedToggleLabel(rows, false), "Show only what you didn't mention (2)");
  assert.equal(unmentionedToggleLabel(rows, true), "Show all 4 rows");
  assert.equal(hiddenSaidRowsLine(rows, true), "Hiding 2 rows you mentioned.");
  assert.equal(hiddenSaidRowsLine([matched, unmentioned], true), "Hiding 1 row you mentioned.");
  assert.equal(hiddenSaidRowsLine(rows, false), "");
  assert.equal(hiddenSaidRowsLine([unmentioned], true), "");
});
