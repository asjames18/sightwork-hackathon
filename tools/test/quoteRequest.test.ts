/** The quote request on a paid row of Who does the work, as plain text. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUOTE_SIGNOFF, quoteRequestText, quoteRequestTitle } from "@/lib/client/quoteRequest";
import { crewSummary } from "@/lib/client/crewSummary";
import type { WorkPlan } from "@/lib/types";

const date = new Date(2026, 9, 31);

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Main  sanctuary stage",
    generatedFrom: "Walkthrough video",
    inventory: [],
    issues: [
      { rank: 1, title: "Cable across the steps", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true },
      { rank: 2, title: "Exit sign dark", detail: "", severity: "high", frameIndex: 1, frameTimeSec: 4, unmentioned: true },
      { rank: 3, title: "Scuffed back wall", detail: "", severity: "low", frameIndex: 2, frameTimeSec: 9, unmentioned: false },
    ],
    materials: [{ item: "Cable cover", qty: "2", forIssues: [1] }],
    workOrder: [
      { order: 1, title: "Reroute the stage cable", detail: "", trade: "Electrician", hours: [1, 2], fixes: [1] },
      { order: 2, title: "Replace the exit sign", detail: "", trade: "Electrician", hours: [1, 1], fixes: [2], dependsOn: 1 },
      { order: 3, title: "Paint the back wall", detail: "", trade: "Painter", hours: [3, 4], fixes: [3], dependsOn: 2 },
      { order: 4, title: "Cover the cable", detail: "", trade: "Volunteer", hours: [1, 1], fixes: [1] },
    ],
    afterImageUrl: null,
    transcript: null,
    costRange: { low: 900, high: 1500, currency: "USD", label: "Rough estimate, not a quote", region: "Atlanta, GA", laborBasis: "mixed", assumptions: [] },
    meta: { region: "Atlanta, GA" } as WorkPlan["meta"],
    ...extra,
  };
}

const row = (p: WorkPlan, label: string) => crewSummary(p.workOrder).rows.find((r) => r.label === label)!;

test("quote request names the job, hours, problems, answers wanted and a permit line for electrical work", () => {
  const p = plan();
  const text = quoteRequestText(p, row(p, "Electrician"), { date })!;
  assert.match(text, /^Quote request: Electrician, Main sanctuary stage\nAtlanta, GA · Oct 31, 2026\n/);
  assert.match(text, /looking for a quote for electrician work at Main sanctuary stage/);
  assert.match(text, /The work:\n- Reroute the stage cable \(we expect about 1-2 h\)\n- Replace the exit sign \(we expect about 1 h\)/);
  assert.match(text, /That is about 2–3 h of work in all, by our own rough estimate\./);
  assert.match(text, /What it is meant to fix:\n- Cable across the steps\n- Exit sign dark/);
  assert.match(text, /Please reply with:\n- your price, and whether it includes materials\n- the earliest day/);
  assert.match(text, /- whether a permit is needed, and who pulls it/);
  assert.ok(text.endsWith(QUOTE_SIGNOFF));
});

test("quote request never shares the plan's own price range or other trades' steps", () => {
  const p = plan();
  const text = quoteRequestText(p, row(p, "Electrician"), { date })!;
  assert.doesNotMatch(text, /\$|900|1,500|Rough estimate/);
  assert.doesNotMatch(text, /Paint the back wall|Cover the cable|Scuffed/);
});

test("a step that waits on another trade says so, and a trade with no permit rule has no permit line", () => {
  const p = plan();
  const text = quoteRequestText(p, row(p, "Painter"), { date })!;
  assert.match(text, /"Paint the back wall" comes after the Electrician finishes "Replace the exit sign"\./);
  assert.doesNotMatch(text, /permit/);
  assert.doesNotMatch(text, /of work in all/);
});

test("volunteers and empty rows get no quote request", () => {
  const p = plan();
  assert.equal(quoteRequestText(p, row(p, "Volunteers"), { date }), null);
  assert.equal(quoteRequestText(p, { label: "Plumber", paid: true, steps: [], hours: null, hoursPartial: false }, { date }), null);
  assert.equal(quoteRequestText(p, { label: "Plumber", paid: true, steps: [99], hours: null, hoursPartial: false }, { date }), null);
});

test("sample plans say so, and a long request is shortened with the sign-off kept", () => {
  const p = plan({ meta: { isExample: true } as WorkPlan["meta"] });
  assert.match(quoteRequestText(p, row(p, "Electrician"), { date })!, /Example plan with sample data, not a real job\./);
  const short = quoteRequestText(p, row(p, "Electrician"), { date, maxChars: 300 })!;
  assert.ok(short.length <= 300);
  assert.match(short, /Shortened for a text\./);
  assert.ok(short.endsWith(QUOTE_SIGNOFF));
});

test("title names the trade and space", () => {
  assert.equal(quoteRequestTitle({ spaceName: " Main  stage " }, "Electrician"), "Quote request: Electrician, Main stage");
  assert.equal(quoteRequestTitle({ spaceName: "" }, ""), "Quote request: paid work, work day");
});
