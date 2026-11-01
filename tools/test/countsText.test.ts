/** The What's there counts as share text (countsText.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { InventoryItem } from "@/lib/types";
import { countLine, countsShareTitle, countsToText, shareableCounts } from "@/lib/client/countsText";
import { SHARE_SIGNOFF } from "@/lib/client/planText";

const item = (o: Partial<InventoryItem> = {}): InventoryItem => ({ label: "chairs", count: 212, confidence: 0.9, method: "sam", ...o });

test("full text, in order, with outlines", () => {
  const text = countsToText(
    [
      item({ zone: "front rows" }),
      item({ label: "stage lights", count: 15, range: [14, 16], method: "sam+model" }),
      item({ label: "exit signs", count: 4, confidence: 0.3, method: "model" }),
    ],
    { masks: true, spaceName: "  Hope City   sanctuary " },
  );
  assert.deepEqual(text?.split("\n"), [
    "Counts · Hope City sanctuary",
    "Approximate, counted from SAM 3.1 outlines.",
    "- 212 chairs (front rows)",
    "- 14-16 stage lights",
    "- 4 exit signs, check by hand",
    "Recount anything marked check by hand before you order or set up.",
    "",
    SHARE_SIGNOFF,
  ]);
});

test("no outlines: estimate wording and no ranges", () => {
  const text = countsToText([item({ range: [200, 220] })], { masks: false }) ?? "";
  assert.ok(text.startsWith("Counts\nApproximate, estimated from the video frames.\n"));
  assert.ok(text.includes("- 212 chairs\n"));
  assert.ok(!text.includes("200-220"));
  assert.ok(!text.includes("Recount"));
});

test("zone already in the label is not repeated; equal range prints one number", () => {
  assert.equal(countLine(item({ label: "Stage monitors", zone: "stage", count: 3 }), true), "3 Stage monitors");
  assert.equal(countLine(item({ count: 5, range: [5, 5] }), true), "5 chairs");
});

test("sample says so; nothing counted gives null; bad items drop out", () => {
  assert.ok(countsToText([item()], { masks: true, sample: true })?.startsWith("Example plan, not a real count.\nCounts\n"));
  assert.equal(countsToText([], { masks: true }), null);
  assert.equal(countsToText(undefined, { masks: true }), null);
  assert.equal(shareableCounts([item({ label: " " }), item({ count: -1 }), item({ count: 2.5 }), item()]).length, 1);
});

test("share title names the space", () => {
  assert.equal(countsShareTitle("Kitchen"), "Counts: Kitchen");
  assert.equal(countsShareTitle(""), "Counts");
});
