/** Richer-findings plan fields (tiers, watch list, coverage note, checklist, SAM boxes), read defensively. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { boxSource, coverageNote, groupByTier, issueExtras, issueTier, rankedIssues, watchItems } from "@/lib/planExtras";
import { areaFor, checklistRows, CHECKLIST_AREAS } from "@/lib/checklist";
import type { Issue, WorkPlan } from "@/lib/types";

const issue = (rank: number, severity: Issue["severity"], extra: Record<string, unknown> = {}): Issue =>
  ({ rank, title: `P${rank}`, detail: "d", severity, frameIndex: 0, frameTimeSec: 0.25, unmentioned: true, ...extra }) as Issue;
const frames = [0, 1, 2].map((index) => ({ index, tSec: index + 0.25, url: `/f${index}.jpg` }));

describe("tiers", () => {
  test("server tier wins; otherwise high/medium/low map to urgent/soon/later", () => {
    assert.equal(issueTier(issue(1, "high")), "urgent");
    assert.equal(issueTier(issue(1, "medium")), "soon");
    assert.equal(issueTier(issue(1, "low")), "later");
    assert.equal(issueTier(issue(1, "low", { tier: "urgent" })), "urgent");
    assert.equal(issueTier(issue(1, "low", { tier: "asap" })), "later");
  });
  test("groups keep tier order and rank order, and leave out empty tiers", () => {
    const g = groupByTier([issue(1, "high"), issue(2, "low"), issue(3, "high"), issue(4, "low")]);
    assert.deepEqual(g.map((x) => x.tier), ["urgent", "later"]);
    assert.deepEqual(g[0].issues.map((i) => i.rank), [1, 3]);
  });
  test("area and evidence: trimmed, capped, absent when not sent", () => {
    assert.deepEqual(issueExtras(issue(1, "high")), { area: undefined, evidence: undefined });
    const x = issueExtras(issue(1, "high", { area: "  stage,  front left ", evidence: "x".repeat(500) }));
    assert.equal(x.area, "stage, front left");
    assert.ok(x.evidence!.length <= 160);
  });
});

describe("watch list", () => {
  test("plan.watch items with a real frame, plus issues marked watch: true", () => {
    const plan = {
      frames,
      issues: [issue(1, "high"), issue(2, "low", { watch: true })],
      watch: [
        { title: "Scuffed wall", detail: "near door", confidence: 0.42, frameIndex: 2, frameTimeSec: 2.25, proofFrames: [{ frameIndex: 2, tSec: 2.25, box: [10, 10, 200, 200], boxSource: "sam" }] },
        { title: "Off frame", frameIndex: 9 },
        { title: "", frameIndex: 0 },
        "junk",
      ],
    } as unknown as WorkPlan;
    const w = watchItems(plan);
    assert.deepEqual(w.map((x) => x.title), ["Scuffed wall", "P2"]);
    assert.equal(w[0].confidence, 0.42);
    assert.equal(boxSource(w[0].proofFrames?.[0]), "sam");
    assert.deepEqual(rankedIssues(plan).map((i) => i.rank), [1]);
  });
  test("today's plans: no watch list, every issue ranked, no coverage note", () => {
    const plan = { frames, issues: [issue(1, "high")] } as unknown as WorkPlan;
    assert.deepEqual(watchItems(plan), []);
    assert.equal(rankedIssues(plan).length, 1);
    assert.equal(coverageNote(plan), undefined);
    assert.equal(coverageNote({ ...plan, coverageNote: "Only the stage was filmed." } as unknown as WorkPlan), "Only the stage was filmed.");
  });
  test("boxes out of range are clamped; inverted ones dropped", () => {
    const plan = { frames, issues: [], watch: [{ title: "A", frameIndex: 0, proofFrames: [{ frameIndex: 0, tSec: 0, box: [-5, 0, 1200, 900] }, { frameIndex: 1, tSec: 1, box: [500, 500, 100, 100] }] }] } as unknown as WorkPlan;
    const refs = watchItems(plan)[0].proofFrames!;
    assert.deepEqual(refs[0].box, [0, 0, 1000, 900]);
    assert.equal(refs[1].box, undefined);
  });
});

describe("checklist", () => {
  test("problems land under their area by checklistKey, else hazard, else Other", () => {
    assert.equal(areaFor({ checklistKey: "stage_edge" }), "life_safety");
    assert.equal(areaFor({ hazard: "trip_cable" }), "av");
    assert.equal(areaFor({ checklistKey: "Lighting" }), "lighting");
    assert.equal(areaFor({ checklistKey: "unicorns" }), "other");
    const rows = checklistRows([issue(1, "high", { checklistKey: "trip_cable" }), issue(2, "low", { checklistKey: "flooring" }), issue(3, "low", { checklistKey: "zzz" })], [{ checklistKey: "walls" }]);
    assert.equal(rows.length, CHECKLIST_AREAS.length + 1);
    assert.equal(rows.find((r) => r.id === "av")!.found, 1);
    assert.equal(rows.find((r) => r.id === "walls")!.watch, 1);
    assert.equal(rows.at(-1)!.id, "other");
    assert.equal(checklistRows([]).length, CHECKLIST_AREAS.length);
  });
  test("every checklist key belongs to one area only", () => {
    const keys = CHECKLIST_AREAS.flatMap((a) => a.keys);
    assert.equal(new Set(keys).size, keys.length);
  });
});
