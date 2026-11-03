/** runPlan validator (validateRunPlanRequest) turn blank text: a direct
 * runPlan caller gets the same fail-fast as the route validator — a
 * turn must carry words, since parseTurns already drops blank turns.
 * Real turns from /api/transcribe are never blank, so no current run
 * changes. A blank turn throws the blank message first (throw, not
 * collect, so unlike the route validator it cannot also draw the
 * order message for the same turn). No network. */
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

test("an empty or whitespace-only turn text is rejected", () => {
  assert.throws(
    () => validateRunPlanRequest(turnsReq([{ startSec: 1, text: "" }])),
    /runPlan: transcriptTurns\[0\]\.text must not be blank/,
  );
  assert.throws(
    () => validateRunPlanRequest(turnsReq([{ startSec: 1, text: "   " }])),
    /runPlan: transcriptTurns\[0\]\.text must not be blank/,
  );
});

test("a turn with words passes, and a blank turn after an ordered turn throws only the blank message", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(turnsReq([{ startSec: 1, text: "hello" }])),
  );
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([
          { startSec: 5, text: "a" },
          { startSec: 6, text: "" },
        ]),
      ),
    { message: "runPlan: transcriptTurns[1].text must not be blank" },
  );
});

test("a blank turn that is also out of order throws the blank message first", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([
          { startSec: 5, text: "a" },
          { startSec: 3, text: "" },
        ]),
      ),
    { message: "runPlan: transcriptTurns[1].text must not be blank" },
  );
});

test("a non-blank inverted turn still throws its own message", () => {
  assert.throws(
    () => validateRunPlanRequest(turnsReq([{ startSec: 5, endSec: 2, text: "x" }])),
    { message: "runPlan: transcriptTurns[0].endSec must not be earlier than startSec" },
  );
});
