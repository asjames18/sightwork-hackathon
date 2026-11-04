/** runPlan's own validator (validateRunPlanRequest) rules for
 * frame times and zone ids, for direct pipeline callers that
 * bypass the route. Frames must arrive in walkthrough order, no
 * frame may sit past durationSec, and a given zoneId must be a
 * whole number >= 0 — all fail fast, before any step runs, so a
 * direct caller cannot hand the reason step a mis-ordered or
 * mis-timed frame set. Equal timestamps and a frame exactly at
 * durationSec still pass, as does zoneId 0. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function frame(tSec: number, extra: Record<string, unknown> = {}) {
  return { tSec, dataUrl: PNG_1PX, ...extra };
}

function req(extra: Record<string, unknown> = {}): PlanRequest {
  return { durationSec: 10, frames: [frame(0)], ...extra } as unknown as PlanRequest;
}

test("an out-of-order frame throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ frames: [frame(0), frame(5), frame(3)] })),
    { message: "runPlan: frames[2].tSec must not be earlier than the previous frame" },
  );
});

test("a frame past durationSec throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ frames: [frame(0), frame(11)] })),
    { message: "runPlan: frames[1].tSec must not exceed durationSec" },
  );
});

test("a negative zoneId throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ frames: [frame(0, { zoneId: -1 })] })),
    { message: "runPlan: frames[0].zoneId must be a whole number >= 0 when given" },
  );
});

test("a fractional zoneId throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ frames: [frame(0), frame(5, { zoneId: 1.5 })] })),
    { message: "runPlan: frames[1].zoneId must be a whole number >= 0 when given" },
  );
});

test("in-order frames, a frame at durationSec, and zoneId 0 still pass", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(
      req({ frames: [frame(0, { zoneId: 0 }), frame(5, { zoneId: 1 }), frame(10, { zoneId: 2 })] }),
    ),
  );
  assert.doesNotThrow(() =>
    validateRunPlanRequest(req({ frames: [frame(0), frame(5), frame(5)] })),
  );
});
