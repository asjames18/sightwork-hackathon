/** Said-vs-saw tags and tally line on the plan screen. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { saidVsSeenKind, saidVsSeenTally, SAID_VS_SEEN_TAG } from "@/lib/client/planText";

const seen = { summary: "Loose plaster overhead", frameIndex: 1 };

test("each row gets one kind", () => {
  assert.equal(saidVsSeenKind({ status: "mentioned", seen }), "matched");
  assert.equal(saidVsSeenKind({ status: "unmentioned", seen }), "unmentioned");
  assert.equal(saidVsSeenKind({ status: "mentioned_not_seen", seen: null }), "notSeen");
  assert.equal(saidVsSeenKind({ status: "mentioned", seen: null }), "notSeen");
  assert.equal(saidVsSeenKind({ status: "mentioned", seen: { summary: "  ", frameIndex: 0 } }), "notSeen");
  assert.equal(SAID_VS_SEEN_TAG.unmentioned, "You didn't mention");
});

test("tally counts each kind and leaves out empty ones", () => {
  assert.equal(
    saidVsSeenTally([
      { status: "mentioned", seen },
      { status: "mentioned", seen },
      { status: "unmentioned", seen },
      { status: "mentioned_not_seen", seen: null },
    ]),
    "2 matched, 1 you didn't mention, 1 to check in person.",
  );
  assert.equal(saidVsSeenTally([{ status: "unmentioned", seen }, { status: "unmentioned", seen }]), "2 you didn't mention.");
});

test("tally is empty with no rows", () => {
  assert.equal(saidVsSeenTally([]), "");
  assert.equal(saidVsSeenTally(null), "");
  assert.equal(saidVsSeenTally(undefined), "");
});
