/** Route validator (validatePlanRequest) turn blank text: a turn must
 * carry words, since parseTurns already drops blank turns. No network. */
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

test("an empty or whitespace-only turn text is rejected", () => {
  assert.deepEqual(
    validatePlanRequest(turnsReq([{ startSec: 1, text: "" }])),
    ["transcriptTurns[0].text must not be blank"],
  );
  assert.deepEqual(
    validatePlanRequest(turnsReq([{ startSec: 1, text: "   " }])),
    ["transcriptTurns[0].text must not be blank"],
  );
});

test("a turn with words passes, and a blank turn after an ordered turn draws only the blank message", () => {
  assert.deepEqual(
    validatePlanRequest(turnsReq([{ startSec: 1, text: "hello" }])),
    [],
  );
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 5, text: "a" },
        { startSec: 6, text: "" },
      ]),
    ),
    ["transcriptTurns[1].text must not be blank"],
  );
});

test("a blank turn that is also out of order draws both messages", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 5, text: "a" },
        { startSec: 3, text: "" },
      ]),
    ),
    [
      "transcriptTurns[1].text must not be blank",
      "transcriptTurns[1].startSec must not be earlier than the previous turn",
    ],
  );
});
