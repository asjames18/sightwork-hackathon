import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue, WorkStep } from "../../src/lib/types";
import { fixFirstShareTitle, fixFirstStepLine, fixFirstToText, SEND_FIX_FIRST_LABEL } from "../../src/lib/client/fixFirstText";
import { SHARE_SIGNOFF } from "../../src/lib/client/planText";

const issue = (rank: number, title: string, severity: Issue["severity"]) =>
  ({ rank, title, severity, category: "safety", detail: "", frameIndex: 0, frameTimeSec: 0 }) as unknown as Issue;

const issues = [issue(1, "Loose cable across the stage edge", "high"), issue(2, "Scuffed wall", "low"), issue(3, "Exit sign out", "high")];
const steps = [
  { order: 1, title: "Tape down cables", fixes: [1], trade: "volunteer", hours: [1, 1] },
  { order: 2, title: "Get a ladder", fixes: [], hours: [0.5, 0.5] },
  { order: 3, title: "Swap the exit sign bulb", fixes: [3], trade: "Electrician", hours: [1, 2], dependsOn: 2 },
  { order: 4, title: "Patch the wall", fixes: [2], trade: "Painter", hours: [2, 3] },
] as unknown as WorkStep[];

test("label and share title", () => {
  assert.equal(SEND_FIX_FIRST_LABEL, "Send Start here");
  assert.equal(fixFirstShareTitle(" Hope City  sanctuary "), "Start here: Hope City sanctuary");
  assert.equal(fixFirstShareTitle(), "Start here");
});

test("fixFirstStepLine: title, trade, hours, waits and done", () => {
  assert.equal(fixFirstStepLine(3, steps[2]), "3. Swap the exit sign bulb (Electrician, about 1–2 h)");
  assert.equal(fixFirstStepLine(1, steps[0], { done: true }), "1. Tape down cables (Volunteer, about 1 h), done");
  assert.equal(fixFirstStepLine(2, steps[1], { before: [3] }), "2. Get a ladder (about 0.5 h), needed before step 3");
  assert.equal(fixFirstStepLine(7, undefined), "7. Step 7");
});

test("fixFirstToText: the Fix now problems, the steps that fix them, totals and sign-off", () => {
  const text = fixFirstToText(issues, steps, { spaceName: "Hope City sanctuary" })!;
  assert.deepEqual(text.split("\n"), [
    "Start here · Hope City sanctuary",
    "2 problems are Fix now:",
    "- #1 Loose cable across the stage edge",
    "- #3 Exit sign out",
    "These 3 steps take care of them:",
    "1. Tape down cables (Volunteer, about 1 h)",
    "2. Get a ladder (about 0.5 h), needed before step 3",
    "3. Swap the exit sign bulb (Electrician, about 1–2 h)",
    "About 2.5–3.5 h of work",
    "The other step can follow once these are done.",
    "",
    SHARE_SIGNOFF,
  ]);
});

test("fixFirstToText: ticked-off steps, cost share and the example note", () => {
  const stepCosts = new Map([
    [1, { low: 20, high: 40 }],
    [2, { low: 0, high: 0 }],
    [3, { low: 100, high: 260 }],
    [4, { low: 300, high: 500 }],
  ]) as never;
  const text = fixFirstToText(issues, steps, { stepCosts, done: [1], sample: true })!;
  const lines = text.split("\n");
  assert.equal(lines[0], "Example plan, not a real inspection.");
  assert.equal(lines[1], "Start here");
  assert.ok(lines.includes("1. Tape down cables (Volunteer, about 1 h), done"));
  assert.ok(lines.includes("About 2.5–3.5 h of work · about $120–$300 of the estimate"));
  assert.ok(lines.includes("Start here: 1 of 3 done."));
});

test("fixFirstToText: a Fix now problem no step covers is named", () => {
  const extra = [...issues, issue(5, "Wobbly rail", "high")];
  const text = fixFirstToText(extra, steps)!;
  assert.ok(text.includes("3 problems are Fix now:"));
  assert.ok(text.includes("These 3 steps take care of most of them:"));
  assert.ok(text.includes("No step covers problem #5 yet, so plan it by hand."));
});

test("fixFirstToText: null when the card shows nothing", () => {
  assert.equal(fixFirstToText([issue(2, "Scuffed wall", "low")], steps), null);
  // The first steps would be the whole plan.
  assert.equal(fixFirstToText(issues, steps.slice(0, 1)), null);
  assert.equal(fixFirstToText(issues, []), null);
});

test("fixFirstToText: one problem, one step, newlines flattened", () => {
  const text = fixFirstToText([issue(1, "Loose\ncable", "high"), issue(2, "Scuffed wall", "low")], [steps[0], steps[3]])!;
  assert.ok(text.includes("1 problem is Fix now:\n- #1 Loose cable\nThis step takes care of it:\n1. Tape down cables"));
});
