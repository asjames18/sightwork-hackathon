/** Route validator (validatePlanRequest) turn duration: a turn must start
 * no later than durationSec, like frames. No network. */
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

test("a turn starting at durationSec passes, a turn starting after it is rejected", () => {
  assert.deepEqual(
    validatePlanRequest(turnsReq([{ startSec: 10, text: "a" }])),
    [],
  );
  assert.deepEqual(
    validatePlanRequest(turnsReq([{ startSec: 11, text: "a" }])),
    ["transcriptTurns[0].startSec must not exceed durationSec"],
  );
});

test("an over-duration turn after an ordered turn draws only the duration message", () => {
  assert.deepEqual(
    validatePlanRequest(
      turnsReq([
        { startSec: 5, text: "a" },
        { startSec: 12, text: "b" },
      ]),
    ),
    ["transcriptTurns[1].startSec must not exceed durationSec"],
  );
});
