/** Counts tile "how it was counted" line (countMethod.ts). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { countMethodNote } from "@/lib/client/countMethod";
import type { InventoryItem } from "@/lib/types";

const item = (extra: Partial<InventoryItem> = {}): InventoryItem => ({ label: "Chairs", count: 10, confidence: 0.8, ...extra });

test("SAM counts say they came from outlines", () => {
  assert.deepEqual(countMethodNote(item({ method: "sam" }), true), { text: "Counted from SAM 3.1 outlines", low: false });
});

test("SAM plus model says agree, or differ when there is a range", () => {
  assert.equal(countMethodNote(item({ method: "sam+model" }), true)?.text, "SAM 3.1 outlines and the model agree");
  assert.equal(countMethodNote(item({ method: "sam+model", range: [8, 12] }), true)?.text, "SAM 3.1 outlines and the model differ, so a range");
  assert.equal(countMethodNote(item({ method: "sam", range: [8, 12] }), true)?.text, "SAM 3.1 outlines and the model differ, so a range");
});

test("model counts, and SAM claims when outlines were skipped, read as estimates", () => {
  assert.equal(countMethodNote(item({ method: "model" }), true)?.text, "Estimated by the model from the frames");
  assert.equal(countMethodNote(item({ method: "sam" }), false)?.text, "Estimated by the model from the frames");
  assert.equal(countMethodNote(item({ method: "model" }), false)?.text, "Estimated by the model from the frames");
});

test("low confidence adds a check-by-hand note, even with no method", () => {
  assert.deepEqual(countMethodNote(item({ method: "sam", confidence: 0.3 }), true), {
    text: "Counted from SAM 3.1 outlines. Low confidence, check by hand",
    low: true,
  });
  assert.deepEqual(countMethodNote(item({ confidence: 0.2 }), true), { text: "Low confidence, check by hand", low: true });
  assert.equal(countMethodNote(item({ confidence: 0.5, method: "model" }), true)?.low, false);
});

test("no method and fine confidence gives no line; junk confidence is not low", () => {
  assert.equal(countMethodNote(item(), true), null);
  assert.equal(countMethodNote(item({ confidence: Number.NaN }), true), null);
});
