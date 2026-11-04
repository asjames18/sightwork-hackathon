/** runPlan's own validator (validateRunPlanRequest) rules for the region,
 * for direct pipeline callers that bypass the route. A region carrying a
 * newline or a {{...}} placeholder used to pass validateRunPlanRequest
 * (it only checked that region was a string and not blank) and only fail
 * later, when the cost prompt was built — after the reason step had
 * already spent its paid call, since the cost step runs after the reason
 * step. The validator now rejects both up front, before any step runs,
 * matching validateCostPromptInput. A clean region, an omitted region,
 * and an empty region (no cost step) still pass, and a blank region
 * keeps its own message. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRunPlanRequest } from "@/lib/pipeline/runPlan";
import type { PlanRequest } from "@/lib/types";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function req(extra: Record<string, unknown> = {}): PlanRequest {
  return { durationSec: 10, frames: [{ tSec: 0, dataUrl: PNG_1PX }], ...extra } as unknown as PlanRequest;
}

test("a region with a newline throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ region: "Sebring,\nFL" })), {
    message: "runPlan: region must not contain a newline",
  });
  assert.throws(() => validateRunPlanRequest(req({ region: "Sebring,\rFL" })), {
    message: "runPlan: region must not contain a newline",
  });
});

test("a region with a {{...}} placeholder throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ region: "Sebring {{region}}" })), {
    message: "runPlan: region must not contain a {{...}} placeholder",
  });
});

test("a clean region still passes, as do an omitted and an empty region", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ region: "Sebring, FL" })));
  assert.doesNotThrow(() => validateRunPlanRequest(req()));
  assert.doesNotThrow(() => validateRunPlanRequest(req({ region: "" })));
});

test("a blank region keeps its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ region: "   " })), {
    message: "runPlan: region must not be blank when given",
  });
});
