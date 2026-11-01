/** One problem as share text (problemText.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Issue, WorkStep } from "@/lib/types";
import { fixedInLine, problemShareTitle, problemToText } from "@/lib/client/problemText";
import { SHARE_SIGNOFF } from "@/lib/client/planText";

const issue = (o: Partial<Issue> = {}): Issue =>
  ({ rank: 2, title: "Loose cable  across the stage edge", detail: "Trip risk for anyone walking to the pulpit.", severity: "high", frameIndex: 3, frameTimeSec: 12, unmentioned: true, area: "front left of the stage", evidence: "black cable on stage floor", ...o }) as Issue;

const steps: WorkStep[] = [
  { order: 1, title: "Clear the stage", detail: "" },
  { order: 3, title: "Tape down stage cables", detail: "", fixes: [2] },
  { order: 4, title: "Re-route the cable run", detail: "", fixes: [2, 5] },
];

test("full text, in order", () => {
  const text = problemToText(issue(), { narrated: true, workOrder: steps, spaceName: "Sanctuary" });
  assert.deepEqual(text.split("\n"), [
    "Problem #2 · Fix now",
    "Loose cable across the stage edge",
    "Where: front left of the stage",
    "Photo shows: black cable on stage floor",
    "High priority. Spotted on video, not mentioned on the walk.",
    "Trip risk for anyone walking to the pulpit.",
    "Fixed in steps 3 and 4: Tape down stage cables; Re-route the cable run",
    "Space: Sanctuary",
    "",
    SHARE_SIGNOFF,
  ]);
});

test("optional lines drop out", () => {
  const text = problemToText(issue({ area: undefined, evidence: undefined, severity: "low", unmentioned: false, rank: 9 }), { narrated: false });
  assert.ok(!text.includes("Where:"));
  assert.ok(!text.includes("Photo shows:"));
  assert.ok(!text.includes("Fixed in"));
  assert.ok(!text.includes("Space:"));
  assert.ok(text.startsWith("Problem #9 · Can wait\n"));
  assert.ok(text.includes("Seen on camera."));
});

test("said but not seen leaves out the photo line", () => {
  const text = problemToText(issue({ status: "mentioned_not_seen", unmentioned: false }), { narrated: true });
  assert.ok(!text.includes("Photo shows:"));
  assert.ok(text.includes("Check in person."));
});

test("example plans say so first", () => {
  assert.ok(problemToText(issue(), { narrated: true, sample: true }).startsWith("Example plan, not a real inspection.\n"));
});

test("detail equal to title is not repeated", () => {
  const text = problemToText(issue({ detail: "Loose cable across the stage edge" }), { narrated: true });
  assert.equal(text.split("\n").filter((l) => l === "Loose cable across the stage edge").length, 1);
});

test("fixedInLine", () => {
  assert.equal(fixedInLine(steps, 5), "Fixed in step 4: Re-route the cable run");
  assert.equal(fixedInLine(steps, 7), null);
  assert.equal(fixedInLine(undefined, 2), null);
  assert.equal(fixedInLine([{ order: 2, title: " ", detail: "", fixes: [1] }], 1), "Fixed in step 2");
});

test("share title", () => {
  assert.equal(problemShareTitle(issue()), "Problem #2: Loose cable across the stage edge");
});
