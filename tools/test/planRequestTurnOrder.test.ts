/** Route validator (validatePlanRequest) turn time order: turns must be non-decreasing in startSec, like frames. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanRequest } from "@/lib/pipeline/planRequest";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}) {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra };
}

function turnsReq(turns: unknown[]) {
  return req({ transcript: "narration", transcriptTurns: turns });
}

test("ordered turns pass, and equal startSec passes", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 0, text: "a" },
        { startSec: 3, text: "b" },
      ]),
    ),
    [],
  );
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 2, text: "a" },
        { startSec: 2, text: "b" },
      ]),
    ),
    [],
  );
});

test("an out-of-order turn is rejected with its own message", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 5, text: "a" },
        { startSec: 3, text: "b" },
      ]),
    ),
    ["transcriptTurns[1].startSec must not be earlier than the previous turn"],
  );
});

test("an out-of-order turn after an inverted turn draws both messages", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 5, endSec: 2, text: "a" },
        { startSec: 4, text: "b" },
      ]),
    ),
    [
      "transcriptTurns[0].endSec must not be earlier than startSec",
      "transcriptTurns[1].startSec must not be earlier than the previous turn",
    ],
  );
});

test("a malformed turn keeps its own message and does not poison the next turn", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: -1, text: "a" },
        { startSec: 0, text: "b" },
      ]),
    ),
    ["transcriptTurns[0] is not a valid turn"],
  );
});
