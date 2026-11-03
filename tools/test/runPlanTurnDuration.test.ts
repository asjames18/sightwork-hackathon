/** runPlan validator (validateRunPlanRequest) turn duration: a direct
 * runPlan caller gets the same fail-fast as the route validator — a
 * turn must start no later than durationSec, like frames, so narration
 * stays aligned with what was seen in the reason step. Real turns
 * from /api/transcribe start inside the audio, so no current run
 * changes. Only the start is checked: an endSec past durationSec is
 * harmless for alignment, since the turn itself still starts inside
 * the video. No network. */
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

test("a turn starting at durationSec passes, a turn starting after it throws with its own message", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(turnsReq([{ startSec: 10, text: "a" }])),
  );
  assert.throws(
    () =>
      validateRunPlanRequest(turnsReq([{ startSec: 11, text: "a" }])),
    /runPlan: transcriptTurns\[0\]\.startSec must not exceed durationSec/,
  );
});

test("an over-duration turn after an ordered turn throws only the duration message", () => {
  assert.throws(
    () =>
      validateRunPlanRequest(
        turnsReq([
          { startSec: 5, text: "a" },
          { startSec: 12, text: "b" },
        ]),
      ),
    /runPlan: transcriptTurns\[1\]\.startSec must not exceed durationSec/,
  );
});
