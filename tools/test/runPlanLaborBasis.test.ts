/** runPlan's own validator (validateRunPlanRequest) rules for
 * laborBasis, for direct pipeline callers that bypass the route.
 * A laborBasis outside "volunteer" | "contractor" | "mixed" used
 * to be caught only downstream, when the cost step read it; the
 * validator now rejects it up front, before any step runs. The
 * three valid values and an omitted laborBasis still pass. No
 * network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra } as unknown as PlanRequest;
}

test("the three valid laborBasis values pass", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ laborBasis: "volunteer" })));
  assert.doesNotThrow(() => validateRunPlanRequest(req({ laborBasis: "contractor" })));
  assert.doesNotThrow(() => validateRunPlanRequest(req({ laborBasis: "mixed" })));
});

test("an omitted laborBasis still passes", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req()));
});

test("an invalid laborBasis throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ laborBasis: "paid" })), {
    message: "runPlan: laborBasis must be volunteer, contractor, or mixed when given",
  });
  assert.throws(() => validateRunPlanRequest(req({ laborBasis: "Volunteer" })), {
    message: "runPlan: laborBasis must be volunteer, contractor, or mixed when given",
  });
  assert.throws(() => validateRunPlanRequest(req({ laborBasis: "" })), {
    message: "runPlan: laborBasis must be volunteer, contractor, or mixed when given",
  });
});
