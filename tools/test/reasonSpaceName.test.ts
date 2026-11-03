/** Reason step validator (validateReasonRequest) space names: parity with
 * buildReasonPrompt, which already rejects a spaceName/spaceType with a
 * newline or a {{...}} placeholder, and a spaceName with a double quote
 * (the prompt build interpolates these names into the prompt text). A
 * direct runReason caller with a prebuilt prompt bypasses the prompt
 * build, so the validator gets the same fail-fast here, before any paid
 * Spark call — a bad name would otherwise ride onto the call and come
 * back printed in the finished plan. Real runs are already valid (the
 * prompt build rejects these before runReason is ever reached), so no
 * current run changes, and plain or omitted names pass. A double quote
 * in spaceType passes: the prompt build only rejects it for spaceName.
 * No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function input(spaceName?: string, spaceType?: string): ReasonInput {
  const out: ReasonInput = {
    frames: [{ tSec: 0, dataUrl: PNG_1PX }],
    segmentation: null,
    transcript: null,
    durationSec: 60,
  };
  if (spaceName !== undefined) out.spaceName = spaceName;
  if (spaceType !== undefined) out.spaceType = spaceType;
  return out;
}

function deps(): ReasonDeps {
  return {
    prompt: "p",
    schema: {},
    callSpark: async () => {
      throw new Error("test: callSpark reached");
    },
    tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
  };
}

test("a spaceName with a newline is rejected", () => {
  assert.throws(
    () => validateReasonRequest(input("Kitchen\nRoom"), deps()),
    {
      message: "reason: spaceName must not contain a newline",
    },
  );
});

test("a spaceType with a carriage return is rejected", () => {
  assert.throws(
    () => validateReasonRequest(input(undefined, "Kitchen\rRoom"), deps()),
    {
      message: "reason: spaceType must not contain a newline",
    },
  );
});

test("a spaceName with a placeholder is rejected", () => {
  assert.throws(
    () => validateReasonRequest(input("My {{space_name}}"), deps()),
    {
      message: "reason: spaceName must not contain a {{...}} placeholder",
    },
  );
});

test("a spaceType with a placeholder is rejected", () => {
  assert.throws(
    () => validateReasonRequest(input(undefined, "{{space_type}}"), deps()),
    {
      message: "reason: spaceType must not contain a {{...}} placeholder",
    },
  );
});

test("a spaceName with a double quote is rejected", () => {
  assert.throws(
    () => validateReasonRequest(input('My "Room"'), deps()),
    {
      message: "reason: spaceName must not contain a double quote",
    },
  );
});

test("a blank spaceName keeps its own message", () => {
  assert.throws(
    () => validateReasonRequest(input("   "), deps()),
    {
      message: "reason: spaceName must be a non-empty string when given",
    },
  );
});

test("a double quote in spaceType passes", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(input(undefined, 'My "Room"'), deps()),
  );
});

test("plain and omitted space names pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(input("Kitchen", "Sanctuary"), deps()),
  );
  assert.doesNotThrow(() => validateReasonRequest(input(), deps()));
});
