/** runPlan's own validator (validateRunPlanRequest) rules for the
 * space labels, for direct pipeline callers that bypass the route.
 * A spaceName or spaceType carrying a newline or a {{...}}
 * placeholder, or a spaceName carrying a double quote, used to pass
 * validateRunPlanRequest (it only checked that the labels were
 * strings and not blank) and only fail later, when the reason prompt
 * was built — after the transcribe and segment calls had already
 * spent their paid calls, since the reason step runs after them.
 * The validator now rejects all three up front, before any step
 * runs, matching buildReasonPrompt. A clean label, an omitted label,
 * and an empty label still pass, and a blank label keeps its own
 * message. A double quote in spaceType still passes: only spaceName
 * is quoted in the reason template, so only it is checked. No
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

test("a spaceName with a newline throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceName: "Sanctuary\nHall" })), {
    message: "runPlan: spaceName must not contain a newline",
  });
  assert.throws(() => validateRunPlanRequest(req({ spaceName: "Sanctuary\rHall" })), {
    message: "runPlan: spaceName must not contain a newline",
  });
});

test("a spaceType with a newline throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceType: "Church\nHall" })), {
    message: "runPlan: spaceType must not contain a newline",
  });
});

test("a spaceName or spaceType with a {{...}} placeholder throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceName: "Sanctuary {{space_name}}" })), {
    message: "runPlan: spaceName must not contain a {{...}} placeholder",
  });
  assert.throws(() => validateRunPlanRequest(req({ spaceType: "Church {{space_type}}" })), {
    message: "runPlan: spaceType must not contain a {{...}} placeholder",
  });
});

test("a spaceName with a double quote throws its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceName: 'Sanctuary "Main" Hall' })), {
    message: "runPlan: spaceName must not contain a double quote",
  });
});

test("clean labels still pass, as do omitted and empty labels", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ spaceName: "Sanctuary", spaceType: "Church hall" })));
  assert.doesNotThrow(() => validateRunPlanRequest(req()));
  assert.doesNotThrow(() => validateRunPlanRequest(req({ spaceName: "", spaceType: "" })));
});

test("a blank label keeps its own message", () => {
  assert.throws(() => validateRunPlanRequest(req({ spaceName: "   " })), {
    message: "runPlan: spaceName must not be blank when given",
  });
  assert.throws(() => validateRunPlanRequest(req({ spaceType: "   " })), {
    message: "runPlan: spaceType must not be blank when given",
  });
});

test("a double quote in spaceType still passes: only spaceName is quoted in the template", () => {
  assert.doesNotThrow(() => validateRunPlanRequest(req({ spaceType: 'Church "Main" Hall' })));
});
