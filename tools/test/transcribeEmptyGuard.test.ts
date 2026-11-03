/** formatTranscribeEmpty malformed-input guard (server log only,
 * transcribe step): the sibling diagnostic lines all stay quiet on
 * malformed input, and this one never checked its boolean sides, so
 * a truthy non-boolean printed the empty-transcription line and a
 * falsy one silently passed as false instead of staying quiet.
 * Non-boolean sides now return null, the same quiet rule. Valid
 * inputs are unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatTranscribeEmpty } from "@/lib/pipeline/runPlan";

type B = Parameters<typeof formatTranscribeEmpty>[0];

describe("formatTranscribeEmpty malformed-input guard", () => {
  test("a truthy non-boolean audio side stays quiet", () => {
    assert.equal(
      formatTranscribeEmpty(1 as unknown as B, false, false, 0),
      null,
    );
  });

  test("a string audio side stays quiet", () => {
    assert.equal(
      formatTranscribeEmpty("yes" as unknown as B, false, false, 0),
      null,
    );
  });

  test("a falsy non-boolean transcript side stays quiet", () => {
    assert.equal(
      formatTranscribeEmpty(true, 0 as unknown as B, false, 0),
      null,
    );
  });

  test("a null failed side stays quiet", () => {
    assert.equal(
      formatTranscribeEmpty(true, false, null as unknown as B, 0),
      null,
    );
  });

  test("a valid empty transcription still logs", () => {
    assert.equal(
      formatTranscribeEmpty(true, false, false, 0),
      "runPlan: transcribe returned no words from supplied audio",
    );
  });

  test("words still stay quiet", () => {
    assert.equal(formatTranscribeEmpty(true, false, false, 3), null);
  });

  test("a supplied transcript still stays quiet", () => {
    assert.equal(formatTranscribeEmpty(true, true, false, 0), null);
  });

  test("a failed transcribe still stays quiet", () => {
    assert.equal(formatTranscribeEmpty(true, false, true, 0), null);
  });

  test("no supplied audio still stays quiet", () => {
    assert.equal(formatTranscribeEmpty(false, false, false, 0), null);
  });

  test("a non-whole word count still stays quiet", () => {
    assert.equal(formatTranscribeEmpty(true, false, false, 0.5), null);
  });
});
