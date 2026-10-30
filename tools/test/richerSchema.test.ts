/** Richer-findings fields declared in types.ts: a plan carrying them still validates and renders as before. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKLIST_KEYS, checkWorkPlan, type HazardKey, type WorkPlan } from "@/lib/types";
import { CHECKLIST_AREAS, areaFor } from "@/lib/checklist";
import { coverageNote, issueExtras, issueTier, rankedIssues, watchItems } from "@/lib/planExtras";
import { metaCredits } from "@/lib/metaCredits";

const HAZARDS: HazardKey[] = ["egress", "trip_cable", "water_stain"];

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "Walkthrough video, 3 frames, 12 s, narrated",
    inventory: [],
    issues: [
      {
        rank: 1, title: "Cable across the stage", detail: "Tape it down.", severity: "medium", frameIndex: 0, frameTimeSec: 0,
        unmentioned: true, tier: "urgent", area: "front of the stage", evidence: "black cable on stage floor near front edge",
        checklistKey: "trip_cable", hazard: "trip_cable",
      },
      { rank: 2, title: "Scuffed wall", detail: "Touch up.", severity: "low", frameIndex: 1, frameTimeSec: 4, unmentioned: false, checklistKey: "walls" },
    ],
    watch: [{ title: "Possible ceiling stain", detail: "Hard to tell from this angle.", confidence: 0.42, frameIndex: 2, frameTimeSec: 8, checklistKey: "ceiling" }],
    coverageNote: "Only the stage was filmed.",
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    transcript: "[0.0] Check the stage.",
    frames: [0, 4, 8].map((tSec, i) => ({ index: i, tSec, url: `/f${i}.jpg` })) as WorkPlan["frames"],
    meta: { planProvider: "baseten" },
    ...extra,
  };
}

test("every known checklist key files under a real area, and every area key is a known checklist key", () => {
  for (const key of CHECKLIST_KEYS) assert.notEqual(areaFor({ checklistKey: key }), "other", key);
  const known = new Set<string>(CHECKLIST_KEYS);
  for (const a of CHECKLIST_AREAS) for (const k of a.keys) assert.ok(known.has(k), k);
});

test("the original hazard keys are all checklist keys, so a hazard can sit in both fields", () => {
  const known = new Set<string>(CHECKLIST_KEYS);
  for (const h of HAZARDS) assert.ok(known.has(h), h);
});

test("a plan with the new fields still passes the shared plan check", () => {
  const p = plan();
  assert.deepEqual(checkWorkPlan(p), []);
});

test("declared fields read straight through: tier, area, evidence, watch list, coverage note", () => {
  const p = plan();
  assert.equal(issueTier(p.issues[0]), "urgent");
  assert.equal(issueTier(p.issues[1]), "later");
  assert.deepEqual(issueExtras(p.issues[0]), { area: "front of the stage", evidence: "black cable on stage floor near front edge" });
  assert.equal(watchItems(p).length, 1);
  assert.equal(watchItems(p)[0].checklistKey, "ceiling");
  assert.equal(coverageNote(p), "Only the stage was filmed.");
  assert.equal(rankedIssues(p).length, 2);
});

test("an issue flagged watch in place leaves the ranked list and joins the closer-look list", () => {
  const p = plan();
  p.issues[1] = { ...p.issues[1], watch: true };
  assert.deepEqual(rankedIssues(p).map((i) => i.rank), [1]);
  assert.deepEqual(watchItems(p).map((w) => w.title), ["Possible ceiling stain", "Scuffed wall"]);
});

test("Listen row says it was off this run when transcribe was skipped, not 'No speech'", () => {
  const p = plan({ transcript: "", meta: { planProvider: "baseten", skipped: { transcribe: true } } });
  const listen = metaCredits(p).find((r) => r.step === "Listen");
  assert.equal(listen?.status, "off");
  assert.match(listen?.note ?? "", /video alone/);
  const quiet = metaCredits(plan({ transcript: "" })).find((r) => r.step === "Listen");
  assert.equal(quiet?.status, "not_needed");
});
