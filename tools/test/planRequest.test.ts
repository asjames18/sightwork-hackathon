/** Route validator (validatePlanRequest) rules for the narration pair: transcript plus transcriptTurns. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanRequest } from "@/lib/pipeline/planRequest";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}) {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra };
}

test("a minimal request with one frame passes", () => {
  assert.deepEqual(validatePlanRequest(req()), []);
});

test("valid turns pass: with endSec, without endSec, and zero-length", () => {
  const turns = [
    { startSec: 0, endSec: 2.5, text: "This is the stage." },
    { startSec: 3, text: "Cables by the steps." },
    { startSec: 4, endSec: 4, text: "" },
  ];
  assert.deepEqual(validatePlanRequest(req({ transcript: "This is the stage.", transcriptTurns: turns })), []);
});

test("an inverted turn (endSec before startSec) is rejected with its own message", () => {
  const problems = validatePlanRequest(
    req({ transcript: "x", transcriptTurns: [{ startSec: 5, endSec: 2, text: "x" }] }),
  );
  assert.deepEqual(problems, ["transcriptTurns[0].endSec must not be earlier than startSec"]);
});

test("a malformed turn keeps the shape message", () => {
  const problems = validatePlanRequest(
    req({ transcript: "x", transcriptTurns: [{ startSec: -1, text: "x" }] }),
  );
  assert.deepEqual(problems, ["transcriptTurns[0] is not a valid turn"]);
});

test("turns without a transcript fail, and a null transcript with no turns passes", () => {
  assert.ok(
    validatePlanRequest(req({ transcriptTurns: [] })).includes("transcriptTurns given without transcript"),
  );
  assert.deepEqual(validatePlanRequest(req({ transcript: null, transcriptTurns: [] })), []);
});

test("a blank transcript string fails", () => {
  assert.deepEqual(validatePlanRequest(req({ transcript: "   " })), ["transcript must not be blank when given"]);
});
