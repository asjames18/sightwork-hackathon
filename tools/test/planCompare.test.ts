/** "Since your last walkthrough": matching problems between two saved runs of the same space. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePlans, compareSummary, matchScore, previousEntry, MATCH_AT } from "@/lib/client/planCompare";
import type { RecentEntry } from "@/lib/client/recentPlans";
import type { Issue, WorkPlan } from "@/lib/types";

function issue(title: string, extra: Partial<Issue> = {}): Issue {
  return { rank: 1, title, detail: "", severity: "medium", frameIndex: 0, frameTimeSec: 0, unmentioned: false, ...extra };
}
function plan(issues: Issue[], extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Main sanctuary",
    generatedFrom: "Walkthrough video",
    inventory: [],
    issues,
    workOrder: [],
    materials: [],
    meta: { region: "Atlanta, GA" },
    ...extra,
  } as WorkPlan;
}

test("same problem filmed twice matches; fixed one is no longer seen; new one is new", () => {
  const before = plan([
    issue("Black cables across the stage steps", { hazard: "trip_cable", area: "front stage steps", severity: "high" }),
    issue("Exit sign not lit", { checklistKey: "exit_sign", area: "back left door", severity: "high" }),
    issue("Scuffed paint on back wall", { category: "cosmetic", severity: "low" }),
  ]);
  const now = plan([
    issue("Cable running across stage steps", { hazard: "trip_cable", area: "stage steps, front", severity: "high" }),
    issue("Water stain on ceiling tile", { hazard: "water_stain", area: "above the choir", severity: "medium" }),
    issue("Scuffed paint on the back wall", { category: "cosmetic", severity: "low" }),
  ]);
  const c = comparePlans(now, before);
  assert.deepEqual(c.stillThere.map((r) => r.title), ["Cable running across stage steps", "Scuffed paint on the back wall"]);
  assert.deepEqual(c.newOnes, [{ title: "Water stain on ceiling tile", tier: "soon" }]);
  assert.deepEqual(c.gone, [{ title: "Exit sign not lit", tier: "urgent" }]);
  assert.equal(compareSummary(c), "1 no longer seen, 2 still there, 1 new");
});

test("different checklist keys never match, even with the same words", () => {
  const a = issue("Loose cable near the door", { checklistKey: "trip_cable" });
  const b = issue("Loose cable near the door", { checklistKey: "egress" });
  assert.equal(matchScore(a, b), 0);
});

test("each earlier problem is used once (two similar now, one before)", () => {
  const before = plan([issue("Cable across stage steps", { hazard: "trip_cable" })]);
  const now = plan([
    issue("Cable across stage steps", { hazard: "trip_cable" }),
    issue("Cable across stage steps by pulpit", { hazard: "trip_cable" }),
  ]);
  const c = comparePlans(now, before);
  assert.equal(c.stillThere.length, 1);
  assert.equal(c.newOnes.length, 1);
  assert.equal(c.gone.length, 0);
});

test("watch items and said-but-not-seen rows are left out", () => {
  const before = plan([issue("Cracked window pane", { watch: true }), issue("Mic stand broken", { status: "mentioned_not_seen" })]);
  const now = plan([]);
  const c = comparePlans(now, before);
  assert.deepEqual(c, { stillThere: [], newOnes: [], gone: [] });
  assert.equal(compareSummary(c), "No problems in either walkthrough");
});

test("unrelated titles stay under the match line", () => {
  assert.ok(matchScore(issue("Exit sign not lit"), issue("Carpet seam lifting")) < MATCH_AT);
});

test("previousEntry picks the newest earlier run of the same space and place", () => {
  const p = plan([]);
  const list: RecentEntry[] = [
    { id: "cur", spaceName: "Main sanctuary", region: "Atlanta, GA", savedAt: "2026-10-31T14:00:00Z", problems: 0, videoName: null },
    { id: "other-place", spaceName: "Main sanctuary", region: "Macon, GA", savedAt: "2026-10-31T13:00:00Z", problems: 1, videoName: null },
    { id: "other-room", spaceName: "Kitchen", region: "Atlanta, GA", savedAt: "2026-10-31T12:30:00Z", problems: 1, videoName: null },
    { id: "prev", spaceName: "main  Sanctuary", region: "atlanta, ga", savedAt: "2026-10-30T18:00:00Z", problems: 3, videoName: null },
    { id: "older", spaceName: "Main sanctuary", region: "Atlanta, GA", savedAt: "2026-10-29T18:00:00Z", problems: 2, videoName: null },
  ];
  assert.equal(previousEntry(p, list, "cur")?.id, "prev");
  // Opening the older run compares it with the one before it, never a later one.
  assert.equal(previousEntry(p, list, "prev")?.id, "older");
  assert.equal(previousEntry(p, list, "older"), null);
  // A plan not in the list yet (just finished, still saving) compares with the newest match.
  assert.equal(previousEntry(p, list, "nope")?.id, "cur");
});

test("a second walkthrough of the same room gets its own saved row", async () => {
  const { recentPlanId } = await import("@/lib/client/recentPlans");
  const first = plan([issue("Cable across stage steps"), issue("Exit sign not lit")], { meta: { region: "Atlanta, GA", costUsd: 0.94 } } as Partial<WorkPlan>);
  const second = plan([issue("Cable across stage steps"), issue("Water stain on ceiling")], { meta: { region: "Atlanta, GA", costUsd: 1.1 } } as Partial<WorkPlan>);
  assert.notEqual(recentPlanId(first), recentPlanId(second));
  assert.equal(recentPlanId(first), recentPlanId(structuredClone(first)));
});
