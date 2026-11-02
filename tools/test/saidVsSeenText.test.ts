/** The said-vs-saw rows on screen as plain text for the send button. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { saidVsSeenRowLine, saidVsSeenShareTitle, saidVsSeenToText } from "@/lib/client/saidVsSeenText";
import { SHARE_SIGNOFF } from "@/lib/client/planText";
import type { SaidVsSeenEntry } from "@/lib/types";
import { kitchenSample } from "@/lib/examples/kitchen";

const row = (r: Partial<SaidVsSeenEntry> & { status: string }) => ({ said: null, seen: null, ...r }) as unknown as SaidVsSeenEntry;
const rows: SaidVsSeenEntry[] = [
  row({ status: "mentioned", said: { quote: "Ceiling is  open", atSec: 9.4 }, seen: { summary: "Loose plaster overhead", frameIndex: 1 }, issueRank: 2 }),
  row({ status: "unmentioned", seen: { summary: "Frayed cable under the pulpit", frameIndex: 3 }, issueRank: 1 }),
  row({ status: "mentioned_not_seen", said: { quote: "The back door sticks", atSec: 41 } }),
  row({ status: "unmentioned", seen: { summary: "Exit sign out", frameIndex: 4 } }),
];

test("groups rows by kind, unmentioned first, with counts, times and problem numbers", () => {
  assert.equal(
    saidVsSeenToText(rows, { spaceName: "Sanctuary stage" }),
    [
      "What you said vs. what we saw · Sanctuary stage",
      "You didn't mention (2):",
      "- Frayed cable under the pulpit (problem 1)",
      "- Exit sign out",
      "Check in person (1):",
      "- Said \u201CThe back door sticks\u201D (41 s), not visible in the video",
      "Matched (1):",
      "- \u201CCeiling is open\u201D (9 s): Loose plaster overhead (problem 2)",
      "",
      SHARE_SIGNOFF,
    ].join("\n"),
  );
});

test("the only-unmentioned toggle sends just those rows; sample plans say so", () => {
  const text = saidVsSeenToText(rows, { onlyUnmentioned: true, sample: true }) ?? "";
  assert.ok(text.startsWith("Example plan, not a real walkthrough.\nWhat you said vs. what we saw\nYou didn't mention (2):"));
  assert.ok(!text.includes("Matched"));
  assert.ok(!text.includes("Check in person"));
});

test("nothing to send: no rows, non-array, junk entries or empty rows give null", () => {
  assert.equal(saidVsSeenToText([]), null);
  assert.equal(saidVsSeenToText(null), null);
  assert.equal(saidVsSeenToText("x" as unknown as SaidVsSeenEntry[]), null);
  assert.equal(saidVsSeenToText([null, 3] as unknown as SaidVsSeenEntry[]), null);
  assert.equal(saidVsSeenRowLine(row({ status: "unmentioned", seen: { summary: "  ", frameIndex: 0 } })), null);
  assert.equal(saidVsSeenRowLine(row({ status: "mentioned_not_seen", said: { quote: "", atSec: 3 } })), null);
  assert.equal(saidVsSeenToText([row({ status: "mentioned", said: { quote: "x", atSec: 1 }, seen: { summary: "Gap", frameIndex: 0 } })], { onlyUnmentioned: true }), null);
});

test("bad times and ranks are left out instead of printing NaN", () => {
  assert.equal(
    saidVsSeenRowLine(row({ status: "mentioned", said: { quote: "Hi", atSec: Number.NaN }, seen: { summary: "Gap", frameIndex: 0 }, issueRank: 0 })),
    "- \u201CHi\u201D: Gap",
  );
});

test("title names the space; kitchen example has text with all six rows", () => {
  assert.equal(saidVsSeenShareTitle(" Sanctuary  stage "), "What we caught: Sanctuary stage");
  assert.equal(saidVsSeenShareTitle(), "What we caught");
  const text = saidVsSeenToText(kitchenSample.saidVsSeen, { spaceName: kitchenSample.spaceName }) ?? "";
  assert.equal(text.split("\n").filter((l) => l.startsWith("- ")).length, 6);
});
