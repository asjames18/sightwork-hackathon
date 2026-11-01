import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue, WorkStep } from "../../src/lib/types";
import { problemsLine, problemsShareTitle, problemsToText, sendShownLabel } from "../../src/lib/client/problemsText";
import { SHARE_SIGNOFF } from "../../src/lib/client/planText";

const issue = (rank: number, title: string, severity: Issue["severity"], extra: Record<string, unknown> = {}) =>
  ({ rank, title, severity, category: "safety", detail: "", frameIndex: 0, frameTimeSec: 0, unmentioned: true, ...extra }) as unknown as Issue;

const steps = [
  { order: 1, title: "Tape down cables", fixes: [2] },
  { order: 3, title: "Swap the bulb", fixes: [2, 4] },
] as unknown as WorkStep[];

test("sendShownLabel: one or many", () => {
  assert.equal(sendShownLabel(1), "Send this one");
  assert.equal(sendShownLabel(3), "Send these 3");
});

test("problemsShareTitle: heading with the space when there is one", () => {
  assert.equal(problemsShareTitle("unmentioned", " Hope City  sanctuary "), "Problems you didn't mention: Hope City sanctuary");
  assert.equal(problemsShareTitle("open"), "Problems still to fix");
});

test("problemsLine: rank, title, area, tier and the steps that fix it", () => {
  assert.equal(problemsLine(issue(2, "Loose cable", "high", { area: "front left of the stage" }), steps), "#2 Loose cable, front left of the stage (Fix now; steps 1 and 3)");
  assert.equal(problemsLine(issue(4, "Exit sign out", "medium"), steps), "#4 Exit sign out (Fix soon; step 3)");
  assert.equal(problemsLine(issue(5, "Scuffed\nwall", "low"), steps), "#5 Scuffed wall (Can wait)");
  // An area already in the title is not repeated.
  assert.equal(problemsLine(issue(6, "Stage edge trip", "low", { area: "stage edge" }), []), "#6 Stage edge trip (Can wait)");
});

test("problemsToText: heading, tally, one line each, sign-off", () => {
  const text = problemsToText([issue(2, "Loose cable", "high"), issue(4, "Exit sign out", "medium")], "unmentioned", { total: 5, spaceName: "Hope City sanctuary", workOrder: steps })!;
  assert.deepEqual(text.split("\n"), [
    "Problems you didn't mention · Hope City sanctuary",
    "2 of 5 problems, spotted on video but not mentioned on the walk.",
    "- #2 Loose cable (Fix now; steps 1 and 3)",
    "- #4 Exit sign out (Fix soon; step 3)",
    "",
    SHARE_SIGNOFF,
  ]);
});

test("problemsToText: still to fix, sample flag, nothing to send", () => {
  const text = problemsToText([issue(1, "Water stain", "medium")], "open", { total: 1, sample: true })!;
  assert.equal(text.split("\n")[0], "Example plan, not a real inspection.");
  assert.equal(text.split("\n")[1], "Problems still to fix");
  assert.equal(text.split("\n")[2], "1 of 1 problem, not fixed yet by the ticked-off work steps.");
  assert.equal(problemsToText([], "open", { total: 3 }), null);
  assert.equal(problemsToText([issue(1, "  ", "low")], "open", { total: 3 }), null);
});
