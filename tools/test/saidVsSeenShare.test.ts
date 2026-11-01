/** The shared text carries the said-vs-saw tally and what was said but not seen. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SHARE_CHARS, planToText, saidVsSeenShareLines } from "@/lib/client/planText";
import type { SaidVsSeenEntry, WorkPlan } from "@/lib/types";
import { kitchenSample } from "@/lib/examples/kitchen";

const DAY = new Date(2026, 9, 31, 14, 0);
const seen = { summary: "Loose plaster overhead", frameIndex: 1 };
const notSeen = (quote: string, atSec: number): SaidVsSeenEntry => ({ status: "mentioned_not_seen", said: { quote, atSec }, seen: null, issueRank: null } as unknown as SaidVsSeenEntry);

test("kitchen example: everything said was seen, so no extra lines", () => {
  assert.deepEqual(saidVsSeenShareLines(kitchenSample), []);
});

test("said but not seen rows are quoted with their time, capped at three", () => {
  const plan: WorkPlan = {
    ...kitchenSample,
    saidVsSeen: [
      { status: "mentioned", said: { quote: "Ceiling is open", atSec: 9 }, seen, issueRank: 1 } as unknown as SaidVsSeenEntry,
      notSeen("The back door sticks", 41),
      notSeen("Outlet by the sink   is dead", 52),
      notSeen("Smell of gas near the stove", 60),
      notSeen("Garage light flickers", 70),
    ],
  };
  assert.deepEqual(saidVsSeenShareLines(plan), [
    "What you said vs. what we saw: 1 matched, 4 to check in person.",
    "Said on the walk, not seen on video (check in person):",
    "- \u201CThe back door sticks\u201D (41 s)",
    "- \u201COutlet by the sink is dead\u201D (52 s)",
    "- \u201CSmell of gas near the stove\u201D (60 s)",
    "- and 1 more",
  ]);
});

test("nothing without narration or rows", () => {
  assert.deepEqual(saidVsSeenShareLines({ ...kitchenSample, transcript: "", transcriptTurns: [] }), []);
  assert.deepEqual(saidVsSeenShareLines({ ...kitchenSample, saidVsSeen: [] }), []);
  const text = planToText({ ...kitchenSample, transcript: "", transcriptTurns: [] }, { date: DAY });
  assert.ok(!text.includes("What you said vs. what we saw"));
});

test("said-but-not-seen lines sit after the counts and are dropped first when the text runs long", () => {
  const plan: WorkPlan = { ...kitchenSample, saidVsSeen: [...(kitchenSample.saidVsSeen ?? []), notSeen("The back door sticks", 41)] };
  const lines = saidVsSeenShareLines(plan);
  assert.equal(lines[0], "What you said vs. what we saw: 3 matched, 3 you didn't mention, 1 to check in person.");
  const full = planToText(plan, { date: DAY, maxChars: 100000 });
  assert.ok(full.includes(`\n\n${lines.join("\n")}\n`));
  const without = planToText(kitchenSample, { date: DAY, maxChars: 100000 });
  assert.equal(planToText(plan, { date: DAY, maxChars: without.length }), without);
  assert.ok(planToText(plan, { date: DAY }).length <= MAX_SHARE_CHARS);
});
