import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAK_MAX_CHARS, canReadAloud, readAloudStatus, shortDetail, speakPlanParts, splitForSpeech } from "../../src/lib/client/speakPlan";
import { EXAMPLES } from "../../src/lib/examples";
import type { WorkPlan } from "../../src/lib/types";

const base = (over: Partial<WorkPlan> = {}): WorkPlan =>
  ({ spaceName: "Fellowship hall", generatedFrom: "", inventory: [], issues: [], materials: [], workOrder: [], afterImageUrl: null, transcript: null, ...over }) as WorkPlan;

const issue = (rank: number, over: Record<string, unknown> = {}) =>
  ({ rank, title: `Problem title ${rank}`, detail: "It is loose. Someone could trip.", severity: "high", frameIndex: 0, frameTimeSec: 1, unmentioned: false, ...over }) as unknown as WorkPlan["issues"][number];

test("shortDetail: whole sentences up to the limit, never mid-thought", () => {
  assert.equal(shortDetail("One. Two. Three."), "One. Two. Three.");
  assert.equal(shortDetail("A short first sentence. " + "word ".repeat(60), 40), "A short first sentence.");
  assert.equal(shortDetail(undefined), "");
  assert.equal(shortDetail('Said at 9 s: "Ceiling\'s opened up here, new drywall." Plaster can drop on whoever is below. Pull it down first.'), "Plaster can drop on whoever is below. Pull it down first.");
  assert.equal(shortDetail("Said at 9 s: \u201cJust the quote.\u201d"), "");
  assert.ok(shortDetail("x".repeat(30) + " " + "y".repeat(300), 100).endsWith("."));
});

test("splitForSpeech: every piece fits and nothing is lost", () => {
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} says a few plain words, then a few more.`).join(" ");
  const parts = splitForSpeech(long);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= SPEAK_MAX_CHARS, p);
  assert.equal(parts.join(" "), long);
  const noBreaks = splitForSpeech("a".repeat(500));
  for (const p of noBreaks) assert.ok(p.length <= SPEAK_MAX_CHARS);
  assert.deepEqual(splitForSpeech("   "), []);
});

test("speakPlanParts: space, problems worst first, steps in order, then cost", () => {
  const plan = base({
    issues: [issue(1, { area: "front of the stage" }), issue(2, { severity: "low", title: "Scuffed wall" })],
    workOrder: [{ order: 1, title: "Tape the cable", detail: "", trade: "volunteer", hours: [1, 2] }, { order: 2, title: "Paint", detail: "" }],
    costRange: { low: 120, high: 1800, currency: "USD", label: "Rough estimate, not a quote", region: "Sebring, FL", laborBasis: "volunteer", assumptions: [] },
  });
  const parts = speakPlanParts(plan);
  assert.equal(parts[0], "Work plan for Fellowship hall, Sebring, FL.");
  assert.equal(parts[1], "2 problems found, worst first.");
  assert.match(parts[2], /^Problem 1, Fix now\. Problem title 1\. Where: front of the stage\. It is loose\. Someone could trip\.$/);
  assert.match(parts[3], /^Problem 2, Can wait\. Scuffed wall\./);
  assert.equal(parts[4], "The work, in order: 2 steps.");
  assert.equal(parts[5], "Step 1. Tape the cable. Who: volunteer. About 1 to 2 hours.");
  assert.equal(parts[6], "Step 2. Paint.");
  assert.equal(parts[7], "Rough cost: 120 dollars to 1,800 dollars in Sebring, FL. This is an estimate, not a quote.");
});

test("speakPlanParts: no problems, long lists, and junk fields are handled", () => {
  assert.deepEqual(speakPlanParts(base()), ["Work plan for Fellowship hall.", "No problems were found in this walkthrough."]);
  const many = base({ issues: Array.from({ length: 11 }, (_, i) => issue(i + 1)), workOrder: Array.from({ length: 13 }, (_, i) => ({ order: i + 1, title: `Step ${i + 1}`, detail: "" })) });
  const parts = speakPlanParts(many);
  assert.ok(parts.includes("3 more problems on the screen."));
  assert.ok(parts.includes("3 more steps on the screen."));
  const junk = base({ spaceName: " ", issues: [{ ...issue(1), title: null, detail: 7 } as never], workOrder: [{ order: "x", title: 5, hours: ["a", 2] } as never] });
  const out = speakPlanParts(junk);
  assert.equal(out[0], "Work plan for this space.");
  assert.ok(out.every((p) => p.length <= SPEAK_MAX_CHARS && !p.includes("undefined") && !p.includes("NaN") && !p.includes("null")));
});

test("speakPlanParts: the example plans all read cleanly", () => {
  for (const ex of EXAMPLES) {
    const parts = speakPlanParts(ex.plan);
    assert.ok(parts.length >= 3);
    for (const p of parts) assert.ok(p.length <= SPEAK_MAX_CHARS && !/undefined|NaN|\[object/.test(p), p);
  }
});

test("canReadAloud and readAloudStatus", () => {
  assert.equal(canReadAloud(undefined), false);
  assert.equal(canReadAloud({}), false);
  assert.equal(canReadAloud({ speechSynthesis: { speak() {}, cancel() {} } }), false);
  assert.equal(canReadAloud({ speechSynthesis: { speak() {}, cancel() {} }, SpeechSynthesisUtterance: function () {} }), true);
  assert.equal(readAloudStatus("idle"), "");
  assert.match(readAloudStatus("reading"), /Stop reading/);
  assert.equal(readAloudStatus("stopped"), "Stopped reading.");
});
