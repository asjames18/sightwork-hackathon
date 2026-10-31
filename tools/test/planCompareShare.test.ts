/** "Since the last walkthrough" in the shared plan text: lines, caps, real-plans-only. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareShareLines, MAX_SHARE_COMPARE, type PlanComparison } from "@/lib/client/planCompare";
import { planToText } from "@/lib/client/planText";
import type { Issue, WorkPlan } from "@/lib/types";

function plan(issues: Partial<Issue>[] = []): WorkPlan {
  return {
    spaceName: "Main sanctuary",
    generatedFrom: "Walkthrough video",
    inventory: [],
    issues: issues.map((x, n) => ({ rank: n + 1, title: `Problem ${n + 1}`, detail: "d", severity: "medium", frameIndex: 0, frameTimeSec: 0, unmentioned: false, ...x })),
    workOrder: [],
    materials: [],
    meta: { region: "Atlanta, GA" },
  } as unknown as WorkPlan;
}

const c: PlanComparison = {
  gone: [{ title: "Exit sign not lit", tier: "urgent" }],
  stillThere: [{ title: "Cable  across\nstage steps", tier: "soon" }],
  newOnes: [{ title: "Water stain on ceiling", tier: "later" }],
};

test("lines: heading with summary and date, one line per group with tiers, then the photo caution", () => {
  assert.deepEqual(compareShareLines(c, "Oct 30, 6:10 PM"), [
    "Since the last walkthrough (Oct 30, 6:10 PM): 1 no longer seen, 1 still there, 1 new.",
    "- No longer seen: Exit sign not lit (fix now)",
    "- Still there: Cable across stage steps (fix soon)",
    "- New this time: Water stain on ceiling (can wait)",
    "Matched by what and where, so check the photos before counting one as fixed.",
  ]);
});

test("empty groups are left out, no date leaves the brackets out, nothing to compare gives no lines", () => {
  const lines = compareShareLines({ gone: [], stillThere: [], newOnes: c.newOnes }, "");
  assert.equal(lines[0], "Since the last walkthrough: 1 new.");
  assert.equal(lines.length, 3);
  assert.deepEqual(compareShareLines({ gone: [], stillThere: [], newOnes: [] }, "Oct 30"), []);
});

test("long groups list a few titles and say how many more", () => {
  const many = Array.from({ length: MAX_SHARE_COMPARE + 2 }, (_, i) => ({ title: `T${i}`, tier: "soon" as const }));
  const line = compareShareLines({ gone: many, stillThere: [], newOnes: [] }, null)[1];
  assert.equal(line, "- No longer seen: T0 (fix soon); T1 (fix soon); T2 (fix soon); and 2 more");
});

test("planToText puts the lines after the problems on real plans, and never on samples", () => {
  const p = plan([{ title: "Cable across stage steps" }]);
  const since = compareShareLines(c, "Oct 30");
  const text = planToText(p, { sinceLines: since, date: new Date("2026-10-31T12:00:00") });
  const at = text.indexOf("Since the last walkthrough (Oct 30)");
  assert.ok(at > text.indexOf("1. Cable across stage steps"), text);
  assert.ok(!planToText(p, { sinceLines: since, sample: true }).includes("Since the last walkthrough"));
  assert.ok(!planToText(p, {}).includes("Since the last walkthrough"));
});
