/** Reviewer pass on the UI side: parsing, the summary line, precomputed example reviews, share text, the stream parser. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReview, precomputeReview, reviewLine, reviewTally, verdictFor, withPrecomputedReview } from "@/lib/review";
import { planToText } from "@/lib/client/planText";
import { parseStatusLine } from "@/lib/client/apiPlanJob";
import { EXAMPLES } from "@/lib/examples";
import type { WorkPlan } from "@/lib/types";

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "Walkthrough video, 2 frames, 10 s, narrated",
    inventory: [],
    issues: [
      { rank: 1, title: "Cable across the steps", detail: "", severity: "high", frameIndex: 0, frameTimeSec: 0, unmentioned: true, proofFrames: [{ frameIndex: 0, tSec: 0, caption: "cord on step" }] },
      { rank: 2, title: "Thermostat set too high", detail: "", severity: "low", frameIndex: 1, frameTimeSec: 5, unmentioned: false, status: "mentioned_not_seen" },
    ],
    materials: [],
    workOrder: [],
    afterImageUrl: null,
    transcript: "[0.0] Check the stage.",
    frames: [
      { index: 0, tSec: 0, url: "/f0.webp" },
      { index: 1, tSec: 65, url: "/f1.webp" },
    ],
    ...extra,
  };
}

test("parseReview drops unknown ids, keeps the first verdict, trims long reasons", () => {
  const r = parseReview(
    {
      ran: true,
      items: [
        { problemId: "1", verified: true, reason: "Photo A shows it." },
        { problemId: "1", verified: false, reason: "dup" },
        { problemId: "9", verified: true, reason: "not a problem" },
        { problemId: 2, verified: false, reason: "x ".repeat(200) },
        { problemId: "2", verified: "yes", reason: "bad type" },
      ],
      source: "model",
      extra: 1,
    },
    plan().issues,
  );
  assert.ok(r);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items[0], { problemId: "1", verified: true, reason: "Photo A shows it." });
  assert.equal(r.items[1].problemId, "2");
  assert.ok(r.items[1].reason.length <= 140);
  assert.equal(r.source, "model");
});

test("parseReview rejects non-reviews and empties items when the review didn't run", () => {
  assert.equal(parseReview(null, []), undefined);
  assert.equal(parseReview({ items: [] }, []), undefined);
  assert.deepEqual(parseReview({ ran: false, items: [{ problemId: "1", verified: true, reason: "" }] }, plan().issues), { ran: false, items: [] });
});

test("review line: model, precomputed, didn't run, none", () => {
  const items = [
    { problemId: "1", verified: true, reason: "ok" },
    { problemId: "2", verified: false, reason: "no photo" },
  ];
  assert.equal(reviewLine({ ran: true, items }), "Reviewed by a separate check: 1 of 2 problems backed by a photo.");
  assert.match(reviewLine({ ran: true, items, source: "precomputed" }) ?? "", /^Proof check for this example: 1 of 2 problems backed by a photo\. .*no model ran\.$/);
  assert.match(reviewLine({ ran: false, items: [] }) ?? "", /^Review didn't run\./);
  assert.equal(reviewLine(undefined), null);
  assert.deepEqual(reviewTally({ ran: true, items }), { verified: 1, total: 2 });
});

test("precomputeReview only records whether a proof photo exists", () => {
  const r = precomputeReview(plan());
  assert.equal(r.source, "precomputed");
  assert.equal(r.ran, true);
  assert.deepEqual(r.items.map((i) => [i.problemId, i.verified]), [["1", true], ["2", false]]);
  assert.equal(r.items[0].reason, "Proof photo at 0:00: cord on step");
  // A frame index that points at nothing is not a proof photo.
  const missing = precomputeReview(plan({ frames: [] }));
  assert.equal(missing.items[0].verified, false);
  // An existing review is never replaced.
  const own = plan({ review: { ran: false, items: [] } });
  assert.equal(withPrecomputedReview(own), own);
});

test("verdictFor matches by rank and ignores reviews that didn't run", () => {
  const p = withPrecomputedReview(plan());
  assert.equal(verdictFor(p.review, p.issues[1])?.verified, false);
  assert.equal(verdictFor({ ran: false, items: [] }, p.issues[0]), undefined);
});

test("every example carries an honest precomputed review", () => {
  for (const e of EXAMPLES) {
    const r = e.plan.review;
    assert.ok(r, e.id);
    assert.equal(r.source, "precomputed", e.id);
    assert.equal(r.items.length, e.plan.issues.length, e.id);
    for (const [k, issue] of e.plan.issues.entries()) {
      const hasPhoto = issue.status !== "mentioned_not_seen" && Boolean(e.plan.frames?.[issue.proofFrames?.[0]?.frameIndex ?? issue.frameIndex]?.url);
      assert.equal(r.items[k].verified, hasPhoto, `${e.id} #${issue.rank}`);
    }
  }
});

test("share text says in plain words when no photo backs a problem, and carries the review line", () => {
  const text = planToText(withPrecomputedReview(plan()));
  assert.match(text, /2\. Thermostat set too high\n   Low priority\. Mentioned on the walk, not seen on video\. Check in person\./);
  assert.doesNotMatch(text, /\[|\]/);
  assert.match(text, /Each problem was matched to its photo ahead of time: 1 of 2 have one\./);
  const seenNoPhoto = plan({ review: { ran: true, items: [{ problemId: "1", verified: false, reason: "not visible" }] } });
  assert.match(planToText(seenNoPhoto), /1\. Cable across the steps\n   High priority\. Spotted on video, not mentioned on the walk\. No photo backs it yet\. Check in person\./);
  assert.match(planToText(seenNoPhoto), /Each problem was checked against a photo: 0 of 1 confirmed\./);
  assert.match(planToText(plan({ review: { ran: false, items: [] } })), /The photo check didn't run/);
  assert.doesNotMatch(planToText(plan()), /photo check|checked against|No photo backs/);
});

test("stream parser: reviewing step, check notes, and the done plan's review", () => {
  assert.deepEqual(parseStatusLine('{"state":"running","step":"reviewing"}'), { state: "running", step: "reviewing" });
  assert.deepEqual(parseStatusLine('{"state":"running","step":"looking","check":{"ok":true,"note":" 17 frames "}}'), {
    state: "running",
    step: "looking",
    check: { ok: true, note: "17 frames" },
  });
  // A bad check is dropped, the line still counts; "reviewing" is never a skipped step.
  assert.deepEqual(parseStatusLine('{"state":"running","step":"planning","check":{"ok":"yes"},"skipped":["reviewing","looking"]}'), {
    state: "running",
    step: "planning",
    skipped: ["looking"],
  });
  const done = parseStatusLine(JSON.stringify({ state: "done", plan: plan({ review: { ran: true, items: [{ problemId: "7", verified: true, reason: "x" }, { problemId: "1", verified: false, reason: "No cord visible." }] } as never }) }));
  assert.ok(done && done.state === "done");
  assert.deepEqual(done.plan.review, { ran: true, items: [{ problemId: "1", verified: false, reason: "No cord visible." }] });
  const junk = parseStatusLine(JSON.stringify({ state: "done", plan: plan({ review: "nope" as never }) }));
  assert.ok(junk && junk.state === "done");
  assert.equal("review" in junk.plan, false);
});
