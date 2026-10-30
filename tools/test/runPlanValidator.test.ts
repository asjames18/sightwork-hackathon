/** runPlan's own validator (validateRunPlanRequest) rules for the narration pair, for direct pipeline callers that bypass the route. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra } as unknown as PlanRequest;
}

test("a minimal request with one frame passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req()));
});

test("valid turns pass: with endSec, without endSec, and zero-length", () => {
  const turns = [
    { startSec: 0, endSec: 2.5, text: "This is the stage." },
    { startSec: 3, text: "Cables by the steps." },
    { startSec: 4, endSec: 4, text: "" },
  ];
  assert.doesNotThrow(() =>
    validateRunPlanRequest(req({ transcript: "This is the stage.", transcriptTurns: turns })),
  );
});

test("an inverted turn (endSec before startSec) throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ transcript: "x", transcriptTurns: [{ startSec: 5, endSec: 2, text: "x" }] })),
    { message: "runPlan: transcriptTurns[0].endSec must not be earlier than startSec" },
  );
});

test("the inverted check reports the right index", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        req({
          transcript: "x",
          transcriptTurns: [
            { startSec: 0, endSec: 1, text: "a" },
            { startSec: 3, endSec: 2.9, text: "b" },
          ],
        }),
      ),
    { message: "runPlan: transcriptTurns[1].endSec must not be earlier than startSec" },
  );
});

test("a malformed turn keeps the shape message", () => {
  assert.throws(
    () => validateRunPlanRequest(req({ transcript: "x", transcriptTurns: [{ startSec: -1, text: "x" }] })),
    { message: "runPlan: transcriptTurns[0] is not a valid turn" },
  );
  assert.throws(
    () => validateRunPlanRequest(req({ transcript: "x", transcriptTurns: [{ startSec: 1, endSec: -2, text: "x" }] })),
    { message: "runPlan: transcriptTurns[0] is not a valid turn" },
  );
});

test("turns without a transcript fail, and a null transcript with no turns passes", () => {
  assert.throws(() => validateRunPlanRequest(req({ transcriptTurns: [] })), {
    message: "runPlan: transcriptTurns given without transcript",
  });
  assert.doesNotThrow(() => validateRunPlanRequest(req({ transcript: null, transcriptTurns: [] })));
});

test("a blank transcript string fails", () => {
  assert.throws(() => validateRunPlanRequest(req({ transcript: "   " })), {
    message: "runPlan: transcript must not be blank when given",
  });
});
