/** Offline plan eval (tools/eval/score.ts): recall, precision, high-severity recall, top-problem check. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scorePlan, type AnswerKey } from "../eval/score";
import sanctuaryRun from "@/lib/examples/sanctuary-run.json";
import type { Issue, WorkPlan } from "@/lib/types";

const key = JSON.parse(readFileSync(new URL("../eval/keys/sanctuary.json", import.meta.url), "utf8")) as AnswerKey;

const issue = (rank: number, title: string, extra: Partial<Issue> = {}): Issue =>
  ({ rank, title, detail: "", severity: "medium", frameIndex: 0, frameTimeSec: 0, unmentioned: false, ...extra }) as Issue;

test("the real sanctuary run keeps its baseline: every high-severity key item found, nothing unmatched", () => {
  const r = scorePlan(sanctuaryRun as unknown as WorkPlan, key);
  assert.equal(r.highRecall, 1);
  assert.ok(r.recall >= 0.8, `recall ${r.recall}`);
  assert.equal(r.precision, 1);
  assert.equal(r.topIsHigh, true);
});

test("an empty plan finds nothing and has nothing to be wrong about", () => {
  const r = scorePlan({ issues: [] }, key);
  assert.equal(r.recall, 0);
  assert.equal(r.precision, 1);
  assert.equal(r.topIsHigh, false);
  assert.deepEqual(r.missed, key.items.map((k) => k.id));
});

test("an off-topic problem lowers precision and is listed as unmatched; mentioned-not-seen is ignored", () => {
  const r = scorePlan(
    { issues: [issue(1, "Loose cable across the stage"), issue(2, "Thermostat set too high"), issue(3, "Stage steps need a handrail", { status: "mentioned_not_seen" })] },
    key,
  );
  assert.deepEqual(r.found, ["trip-cables"]);
  assert.deepEqual(r.unmatched, [2]);
  assert.equal(r.precision, 0.5);
  assert.equal(r.topIsHigh, true);
});
