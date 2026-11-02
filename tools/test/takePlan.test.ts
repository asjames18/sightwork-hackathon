/** Saved take to its plan: exact name, plan saved after the take, newest wins. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planForTake, takePlanLine } from "@/lib/client/takePlan";
import type { RecentEntry } from "@/lib/client/recentPlans";

const recent = (id: string, videoName: string | null, savedAt: string, problems = 3, spaceName = "Sanctuary stage"): RecentEntry => ({
  id,
  spaceName,
  region: null,
  savedAt,
  problems,
  videoName,
});
const take = { name: "walkthrough-2026-11-02-1240.mp4", savedAt: "2026-11-02T17:40:00.000Z" };

test("matches the plan made from the take's file name", () => {
  const r = recent("p1", take.name, "2026-11-02T17:43:00.000Z");
  assert.equal(planForTake([recent("p0", "other.mp4", "2026-11-02T17:45:00.000Z"), r], take), r);
});

test("no plan: none listed, a different name, or a null videoName", () => {
  assert.equal(planForTake([], take), null);
  assert.equal(planForTake([recent("p1", "walkthrough-2026-11-02-1241.mp4", "2026-11-02T17:43:00.000Z")], take), null);
  assert.equal(planForTake([recent("p1", null, "2026-11-02T17:43:00.000Z")], take), null);
  assert.equal(planForTake([recent("p1", take.name, "2026-11-02T17:43:00.000Z")], { name: "", savedAt: take.savedAt }), null);
});

test("an older plan with the same name (saved before the take) never matches", () => {
  assert.equal(planForTake([recent("old", take.name, "2026-11-01T17:43:00.000Z")], take), null);
});

test("newest plan wins, whatever the list order", () => {
  const a = recent("a", take.name, "2026-11-02T17:43:00.000Z");
  const b = recent("b", take.name, "2026-11-02T18:10:00.000Z");
  assert.equal(planForTake([a, b], take), b);
  assert.equal(planForTake([b, a], take), b);
});

test("unreadable dates: a bad plan date is skipped, a bad take date still matches by name", () => {
  assert.equal(planForTake([recent("x", take.name, "not a date")], take), null);
  const r = recent("p1", take.name, "2026-11-02T17:43:00.000Z");
  assert.equal(planForTake([r], { name: take.name, savedAt: "??" }), r);
});

test("line reads the space and problem count", () => {
  assert.equal(takePlanLine({ spaceName: "Sanctuary stage", problems: 6 }), "Plan made: Sanctuary stage · 6 problems");
  assert.equal(takePlanLine({ spaceName: "Sanctuary stage", problems: 1 }), "Plan made: Sanctuary stage · 1 problem");
  assert.equal(takePlanLine({ spaceName: "  ", problems: 0 }), "Plan made: Walkthrough · no problems found");
  assert.equal(takePlanLine({ spaceName: "Hall", problems: Number.NaN }), "Plan made: Hall · no problems found");
});
