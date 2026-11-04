/** runPlan's own validator (validateRunPlanRequest) rules for
 * label types, for direct pipeline callers that bypass the route.
 * A spaceName, spaceType, or region that is not a string throws
 * its own message up front, before any step runs, so a direct
 * caller cannot hand the reason or cost step a number where a
 * label belongs. A string label still passes, as does an omitted
 * label. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra } as unknown as PlanRequest;
}

test("a non-string spaceName throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceName: 42 })), {
    message: "runPlan: spaceName must be a string when given",
  });
});

test("a non-string spaceType throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceType: 42 })), {
    message: "runPlan: spaceType must be a string when given",
  });
});

test("a non-string region throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ region: 42 })), {
    message: "runPlan: region must be a string when given",
  });
});

test("string labels still pass, as do omitted labels", () => {
  assert.doesNotThrow(() =>
    validateRunPlanRequest(req({ spaceName: "Sanctuary", spaceType: "Church hall", region: "Sebring, FL" })),
  );
  assert.doesNotThrow(() => validateRunPlanRequest(req()));
});
