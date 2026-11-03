/** Old-plan note (planAge.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OLD_PLAN_DAYS, planAgeDays, planAgeNote } from "@/lib/client/planAge";

const now = new Date("2026-11-03T12:00:00Z");
const ago = (days: number, extraHours = 0) => new Date(now.getTime() - (days * 24 + extraHours) * 3600_000).toISOString();

test("a plan counts whole days since it was saved", () => {
  assert.equal(planAgeDays(ago(0, 5), now), 0);
  assert.equal(planAgeDays(ago(3, 23), now), 3);
  assert.equal(planAgeDays(ago(12), now), 12);
});

test("a missing, unreadable or future time gives no age", () => {
  assert.equal(planAgeDays(undefined, now), null);
  assert.equal(planAgeDays(null, now), null);
  assert.equal(planAgeDays("", now), null);
  assert.equal(planAgeDays("not a date", now), null);
  assert.equal(planAgeDays("2026-11-05T00:00:00Z", now), null);
  assert.equal(planAgeNote("not a date", now), null);
});

test("a plan under a week old gets no note", () => {
  assert.equal(planAgeNote(ago(0), now), null);
  assert.equal(planAgeNote(ago(OLD_PLAN_DAYS - 1, 23), now), null);
});

test("a plan a week or more old says how old, with its day", () => {
  const week = planAgeNote(ago(OLD_PLAN_DAYS), now);
  assert.ok(week);
  assert.equal(week.days, 7);
  assert.match(week.text, /^This plan was made 7 days ago \(Oct 27, 2026\)\./);
  assert.match(week.text, /film it again/);
  assert.match(planAgeNote(ago(13), now)!.text, /made 13 days ago/);
});

test("older plans are said in weeks, then months", () => {
  assert.match(planAgeNote(ago(14), now)!.text, /made 2 weeks ago/);
  assert.match(planAgeNote(ago(30), now)!.text, /made 4 weeks ago/);
  assert.match(planAgeNote(ago(75), now)!.text, /made 2 months ago/);
});
