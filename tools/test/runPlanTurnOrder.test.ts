/** runPlan validator (validateRunPlanRequest) turn time order: a direct
 * runPlan caller gets the same fail-fast as the route validator —
 * turns must be non-decreasing in startSec, like frames, so narration
 * stays aligned with what was seen in the reason step. Real turns
 * from /api/transcribe are already sorted, so no current run changes.
 * No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function turnsReq(turns: unknown[]) {
  return {
    durationSec: 10,
    frames: [{ tSec: 0, dataUrl: PNG_1PX }],
    transcript: "narration",
    transcriptTurns: turns,
  } as never;
}

test("ordered turns pass, and equal startSec passes", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(
      turnsReq([
        { startSec: 0, text: "a" },
        { startSec: 3, text: "b" },
      ]),
    ),
  );
  assert.doesNotThrow(() =>
    validateRunPlanRequest(
      turnsReq([
        { startSec: 2, text: "a" },
        { startSec: 2, text: "b" },
      ]),
    ),
  );
});

test("an out-of-order turn throws with its own message", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([
          { startSec: 5, text: "a" },
          { startSec: 3, text: "b" },
        ]),
      ),
    /runPlan: transcriptTurns\[1\]\.startSec must not be earlier than the previous turn/,
  );
});

test("an inverted turn still throws its own message first", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([{ startSec: 5, endSec: 2, text: "a" }]),
      ),
    /runPlan: transcriptTurns\[0\]\.endSec must not be earlier than startSec/,
  );
});

test("a malformed turn still throws its own message", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([{ startSec: -1, text: "a" }]),
      ),
    /runPlan: transcriptTurns\[0\] is not a valid turn/,
  );
});
