/** Plan as plain text for "Send to your team", and the share-or-copy fallback. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planToText, sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { COST_LABEL, type WorkPlan } from "@/lib/types";

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Main sanctuary  stage",
    generatedFrom: "Walkthrough video, 12 frames, 60 s, narrated",
    inventory: [],
    issues: [
      { rank: 2, title: "Loose carpet seam", detail: "", severity: "medium", frameIndex: 1, frameTimeSec: 5, unmentioned: false },
      { rank: 1, title: "Cable across the steps", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true },
    ],
    materials: [{ item: "Cable cover", qty: "2" }],
    workOrder: [
      { order: 2, title: "Re-tape the seam", detail: "" },
      { order: 1, title: "Cover the cable", detail: "", trade: "Volunteer", hours: [0.5, 1] },
    ],
    afterImageUrl: null,
    transcript: "[0.0] Check the stage.",
    transcriptSummary: "Get the stage ready for Sunday.",
    ...extra,
  };
}

test("lists problems worst first, steps in order, materials, with labels", () => {
  const t = planToText(plan());
  assert.match(t, /^Work plan: Main sanctuary stage\n/);
  assert.match(t, /Asked for: Get the stage ready for Sunday\./);
  assert.match(t, /Problems, worst first \(2\):\n1\. Cable across the steps \(High\) \[not mentioned\]\n2\. Loose carpet seam \(Medium\)\n/);
  assert.match(t, /Do the work in this order:\n1\. Cover the cable \(Volunteer, 0\.5-1 h\)\n2\. Re-tape the seam\n/);
  assert.match(t, /Materials:\n- Cable cover: 2\n/);
  assert.doesNotMatch(t, /Rough cost/);
  assert.doesNotMatch(t, /Example plan/);
});

test("no narration: no 'not mentioned' tags and no ask line", () => {
  const t = planToText(plan({ transcript: null, transcriptTurns: [] }));
  assert.doesNotMatch(t, /not mentioned/);
  assert.doesNotMatch(t, /Asked for/);
});

test("cost line always carries the not-a-quote label and region", () => {
  const t = planToText(
    plan({ costRange: { low: 120, high: 340, currency: "USD", label: COST_LABEL, region: "Sebring, FL", laborBasis: "volunteer", assumptions: [] } }),
  );
  assert.match(t, /Rough cost: \$120-\$340 \(Rough estimate, not a quote, Sebring, FL\)/);
});

test("an example plan says it is sample data, and an empty plan says so", () => {
  const t = planToText(plan({ issues: [], workOrder: [], materials: [], meta: { isExample: true } }));
  assert.match(t, /Example plan with sample data/);
  assert.match(t, /No problems found/);
  assert.doesNotMatch(t, /Do the work/);
  assert.doesNotMatch(t, /Materials:/);
});

test("long plans are cut at a line break with a pointer to the full plan", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ order: i + 1, title: `Step number ${i + 1} with some words`, detail: "" }));
  const t = planToText(plan({ workOrder: many }), { maxChars: 800 });
  assert.ok(t.length <= 800, `length ${t.length}`);
  assert.match(t, /\n\.\.\.\nSee the full plan for the rest\.$/);
  assert.match(t.split("\n...\n")[0], /\n[^\n]*$/);
});

test("share: uses the share sheet when preferred and available", async () => {
  let shared = 0;
  const nav: ShareNavigator = { share: async () => { shared++; }, clipboard: { writeText: async () => assert.fail("no copy") } };
  assert.equal(await sharePlanText("t", "x", nav, true), "shared");
  assert.equal(shared, 1);
});

test("share: a dismissed share sheet is cancelled and does not copy", async () => {
  const abort = Object.assign(new Error("dismissed"), { name: "AbortError" });
  const nav: ShareNavigator = { share: async () => { throw abort; }, clipboard: { writeText: async () => assert.fail("no copy") } };
  assert.equal(await sharePlanText("t", "x", nav, true), "cancelled");
});

test("share: falls back to the clipboard when share is refused, unpreferred, or missing", async () => {
  const copied: string[] = [];
  const clipboard = { writeText: async (s: string) => { copied.push(s); } };
  assert.equal(await sharePlanText("t", "a", { share: async () => { throw new Error("NotAllowed"); }, clipboard }, true), "copied");
  assert.equal(await sharePlanText("t", "b", { share: async () => assert.fail("not preferred"), clipboard }, false), "copied");
  assert.equal(await sharePlanText("t", "c", { canShare: () => false, share: async () => assert.fail("cannot"), clipboard }, true), "copied");
  assert.deepEqual(copied, ["a", "b", "c"]);
});

test("share: fails cleanly with no share sheet and no clipboard, or a rejected copy", async () => {
  assert.equal(await sharePlanText("t", "x", {}, true), "failed");
  assert.equal(await sharePlanText("t", "x", { clipboard: { writeText: async () => { throw new Error("denied"); } } }, false), "failed");
});

test("the sample flag from the screen overrides meta, both ways", () => {
  assert.match(planToText(plan(), { sample: true }), /Example plan with sample data/);
  assert.doesNotMatch(planToText(plan({ meta: { isExample: true } }), { sample: false }), /Example plan/);
});
