/** Summary card problem list (summaryTitles.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryMoreLine, summaryTitles } from "@/lib/client/summaryTitles";

const issues = (n: number) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, title: `Problem ${i + 1}` }));

test("shows every problem when there are few", () => {
  const r = summaryTitles(issues(3));
  assert.deepEqual(r.items.map((i) => i.rank), [1, 2, 3]);
  assert.equal(r.more, 0);
});

test("one over the cap is shown rather than '+1 more'", () => {
  const r = summaryTitles(issues(5));
  assert.equal(r.items.length, 5);
  assert.equal(r.more, 0);
});

test("caps a long list and counts the rest", () => {
  const r = summaryTitles(issues(9));
  assert.deepEqual(r.items.map((i) => i.title), ["Problem 1", "Problem 2", "Problem 3", "Problem 4"]);
  assert.equal(r.more, 5);
  assert.equal(summaryMoreLine(r.more), "+5 more below");
});

test("keeps each problem's own rank, so a filtered list still matches the cards", () => {
  const r = summaryTitles([{ rank: 2, title: "Cable" }, { rank: 5, title: "Light" }]);
  assert.deepEqual(r.items, [{ rank: 2, title: "Cable" }, { rank: 5, title: "Light" }]);
});

test("tidies whitespace and drops blank titles", () => {
  const r = summaryTitles([{ rank: 1, title: "  Loose \n cable " }, { rank: 2, title: "   " }]);
  assert.deepEqual(r.items, [{ rank: 1, title: "Loose cable" }]);
  assert.equal(r.more, 0);
});

test("empty list and odd caps", () => {
  assert.deepEqual(summaryTitles([]), { items: [], more: 0 });
  assert.equal(summaryTitles(issues(9), 0).items.length, 1);
  assert.equal(summaryTitles(issues(9), Number.NaN).items.length, 4);
  assert.equal(summaryMoreLine(0), null);
});
