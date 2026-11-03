/** Reason step validator (validateReasonRequest) frame zoneId: parity with
 * buildReasonPrompt, which already rejects a zoneId that is not a whole
 * number >= 0 when given, and with the route validator
 * (src/lib/pipeline/planRequest.ts). A direct runReason caller with a
 * prebuilt prompt bypasses the prompt build, so the validator gets the
 * same fail-fast here, before any paid Spark call — a bad zone would
 * otherwise print verbatim in the prompt's frame list (zone=-1, zone=1.5)
 * and mislabel which zone a proof frame came from. Real runs are already
 * valid (the route validates zoneId before runPlan hands frames over),
 * so no current run changes, and omitted or whole-number zoneIds pass.
 * No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type Frame = { tSec: number; dataUrl: string; zoneId?: number };

function input(frames: Frame[]): ReasonInput {
  return {
    frames,
    segmentation: null,
    transcript: null,
    durationSec: 60,
  };
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

test("a negative zoneId is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          { tSec: 0, dataUrl: PNG_1PX, zoneId: 0 },
          { tSec: 5, dataUrl: PNG_1PX, zoneId: -1 },
        ]),
        deps(),
      ),
    {
      message:
        "reason: frame 1 zoneId must be a whole number >= 0 when given",
    },
  );
});

test("a fractional zoneId is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([{ tSec: 0, dataUrl: PNG_1PX, zoneId: 1.5 }]),
        deps(),
      ),
    {
      message:
        "reason: frame 0 zoneId must be a whole number >= 0 when given",
    },
  );
});

test("a non-number zoneId is rejected", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([
          {
            tSec: 0,
            dataUrl: PNG_1PX,
            zoneId: "1" as unknown as number,
          },
        ]),
        deps(),
      ),
    {
      message:
        "reason: frame 0 zoneId must be a whole number >= 0 when given",
    },
  );
});

test("omitted and whole-number zoneIds pass", () => {
  assert.doesNotThrow(() =>
    validateReasonRequest(
      input([
        { tSec: 0, dataUrl: PNG_1PX },
        { tSec: 5, dataUrl: PNG_1PX, zoneId: 0 },
        { tSec: 10, dataUrl: PNG_1PX, zoneId: 2 },
      ]),
      deps(),
    ),
  );
});

test("a malformed frame keeps its own message", () => {
  assert.throws(
    () =>
      validateReasonRequest(
        input([{ tSec: 0, dataUrl: "not-an-image", zoneId: -1 }]),
        deps(),
      ),
    {
      message: "reason: frame 0 dataUrl must be a data:image base64 URL",
    },
  );
});
