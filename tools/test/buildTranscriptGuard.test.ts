/** buildTranscript input guard: a non-array turns value, or a turn
 * that is not an object or has no finite startSec / string text,
 * throws a named transcribe error instead of a raw TypeError from
 * .length/.toFixed below. Valid turns still build the "[t] text"
 * lines, and an empty array still means no transcript (null). No
 * network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildTranscript } from "@/lib/pipeline/transcribe";

describe("buildTranscript input guard", () => {
  test("non-array turns throw a named transcribe error", () => {
    assert.throws(
      () => (buildTranscript as (t: unknown) => unknown)(null),
      /transcribe: turns must be an array/,
    );
    assert.throws(
      () => (buildTranscript as (t: unknown) => unknown)("not turns"),
      /transcribe: turns must be an array/,
    );
    assert.throws(
      () => (buildTranscript as (t: unknown) => unknown)({ startSec: 0, text: "hi" }),
      /transcribe: turns must be an array/,
    );
  });

  test("malformed turns throw a named transcribe error naming the turn", () => {
    assert.throws(
      () => (buildTranscript as (t: unknown) => unknown)([null]),
      /transcribe: turn 0 is not an object/,
    );
    assert.throws(
      () => (buildTranscript as (t: unknown) => unknown)([{ startSec: Number.NaN, text: "hi" }]),
      /transcribe: turn 0 has no valid startSec/,
    );
    assert.throws(
      () =>
        (buildTranscript as (t: unknown) => unknown)([
          { startSec: 0, text: "ok" },
          { startSec: 1, text: 42 },
        ]),
      /transcribe: turn 1 has no valid text/,
    );
  });

  test("valid turns still build, and an empty array still means null", () => {
    assert.equal(buildTranscript([]), null);
    assert.equal(
      buildTranscript([
        { startSec: 0, text: "first" },
        { startSec: 12.34, text: "second" },
      ]),
      "[0.0] first\n[12.3] second",
    );
  });
});
