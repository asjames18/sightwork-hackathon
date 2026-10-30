/** runPlan's own validator (validateRunPlanRequest) rejects non-empty transcriptTurns with a null transcript (0aa8bbd). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const TURNS = [{ startSec: 0, endSec: 2, text: "the left speaker is loose" }];
const NO_TRANSCRIPT = "runPlan: transcriptTurns given without transcript";

function req(fields: Record<string, unknown>): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...fields } as unknown as PlanRequest;
}

test("no transcript fields at all passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({})));
});

test("null transcript with an empty turns array passes (the empty-narration result)", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ transcript: null, transcriptTurns: [] })));
});

test("null transcript with no turns field passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ transcript: null })));
});

test("null transcript with real turns fails", () => {
  assert.throws(() => validateRunPlanRequest(req({ transcript: null, transcriptTurns: TURNS })), {
    message: NO_TRANSCRIPT,
  });
});

test("turns with the transcript left out still fail with the same message", () => {
  assert.throws(() => validateRunPlanRequest(req({ transcriptTurns: TURNS })), { message: NO_TRANSCRIPT });
});

test("a real transcript with turns passes", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(req({ transcript: "the left speaker is loose", transcriptTurns: TURNS })),
  );
});

test("the null-transcript check runs before the per-turn shape check", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ transcript: null, transcriptTurns: [{ startSec: -1, text: 3 }] })),
    { message: NO_TRANSCRIPT },
  );
});
