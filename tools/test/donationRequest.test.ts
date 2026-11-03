/** The donation request beside the shopping list, as plain text. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DONATION_SIGNOFF, MAX_DONATION_ITEMS, donationRequestText, donationRequestTitle } from "@/lib/client/donationRequest";
import type { WorkPlan } from "@/lib/types";

const date = new Date(2026, 9, 31);

function plan(extra: Partial<WorkPlan> = {}): Pick<WorkPlan, "spaceName" | "materials" | "costRange" | "meta"> {
  return {
    spaceName: "Main  sanctuary stage",
    materials: [
      { item: "Cable cover", qty: "2", forIssues: [1], unitCost: [20, 30] },
      { item: "LED exit sign", qty: "1", forIssues: [2], unitCost: [40, 60] },
      { item: "Paint,  satin", qty: "2 gallons" },
    ],
    costRange: { low: 900, high: 1500, currency: "USD", label: "Rough estimate, not a quote", region: "Atlanta, GA", laborBasis: "mixed", assumptions: [] },
    meta: { region: "Atlanta, GA" } as WorkPlan["meta"],
    ...extra,
  };
}

test("donation request names the project, lists items with amounts and says what to answer", () => {
  const text = donationRequestText(plan(), [], { date });
  assert.match(text, /^Donation request: Main sanctuary stage\nAtlanta, GA · Oct 31, 2026\n/);
  assert.match(text, /volunteer team fixing up Main sanctuary stage/);
  assert.match(text, /- Cable cover: 2\n- LED exit sign: 1\n- Paint, satin: 2 gallons/);
  assert.match(text, /Please reply with:\n- what you could donate/);
  assert.ok(text.endsWith(DONATION_SIGNOFF));
});

test("donation request never shares prices or the plan's cost range", () => {
  const text = donationRequestText(plan(), [], { date });
  assert.doesNotMatch(text, /\$\d/);
  assert.doesNotMatch(text, /900|1,?500|Rough estimate/);
});

test("ticked items are left out, and nothing left gives an empty string", () => {
  const text = donationRequestText(plan(), [0, 2], { date });
  assert.match(text, /- LED exit sign: 1/);
  assert.doesNotMatch(text, /Cable cover|Paint/);
  assert.equal(donationRequestText(plan(), [0, 1, 2], { date }), "");
  assert.equal(donationRequestText(plan({ materials: [] }), [], { date }), "");
});

test("a long list names the first items and counts the rest", () => {
  const materials = Array.from({ length: MAX_DONATION_ITEMS + 3 }, (_, i) => ({ item: `Item ${i + 1}`, qty: "1" }));
  const text = donationRequestText(plan({ materials }), [], { date, maxChars: 5000 });
  assert.match(text, new RegExp(`- Item ${MAX_DONATION_ITEMS}: 1\\n- and 3 more`));
  assert.doesNotMatch(text, new RegExp(`Item ${MAX_DONATION_ITEMS + 1}:`));
});

test("a text that runs long is shortened but keeps the sign-off", () => {
  const text = donationRequestText(plan(), [], { date, maxChars: 300 });
  assert.ok(text.length <= 300);
  assert.match(text, /Shortened for a text\./);
  assert.ok(text.endsWith(DONATION_SIGNOFF));
});

test("example plans say so, and the share title names the project", () => {
  assert.match(donationRequestText(plan(), [], { date, sample: true }), /Example plan with sample data, not a real project\./);
  assert.equal(donationRequestTitle({ spaceName: " Main  sanctuary " }), "Donation request: Main sanctuary");
  assert.equal(donationRequestTitle({ spaceName: "" }), "Donation request: work day");
});
