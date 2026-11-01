/**
 * formatTranscribeEmpty (server log only, listening step): reports when supplied audio
 * transcribes to no words, so a real run can tell an empty ASR result apart from a silent
 * video — the listening check note reads "No narration in this video" in both cases, and a
 * failed transcribe already warns separately. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatTranscribeEmpty } from "@/lib/pipeline/runPlan";

const LINE = "runPlan: transcribe returned no words from supplied audio";

describe("formatTranscribeEmpty", () => {
  test("no audio stays quiet", () => {
    assert.equal(formatTranscribeEmpty(false, false, false, 0), null);
  });

  test("pre-supplied transcript stays quiet", () => {
    assert.equal(formatTranscribeEmpty(true, true, false, 0), null);
  });

  test("failed transcribe stays quiet (it already warns)", () => {
    assert.equal(formatTranscribeEmpty(true, false, true, 0), null);
  });

  test("words back stays quiet", () => {
    assert.equal(formatTranscribeEmpty(true, false, false, 5), null);
  });

  test("supplied audio with no words is reported", () => {
    assert.equal(formatTranscribeEmpty(true, false, false, 0), LINE);
  });

  test("malformed word counts stay quiet", () => {
    assert.equal(formatTranscribeEmpty(true, false, false, -1), null);
    assert.equal(formatTranscribeEmpty(true, false, false, 1.5), null);
    assert.equal(formatTranscribeEmpty(true, false, false, NaN), null);
  });
});
