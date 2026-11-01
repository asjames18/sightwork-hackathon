/**
 * buildReasonPrompt rejects a newline (or carriage return) in the space
 * name or the space type, instead of printing it verbatim, so the prompt
 * line that carries the name or type cannot split into two. The
 * transcript keeps its newlines: it is multi-line by design.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReasonPrompt } from "@/lib/pipeline/planPrompts";
import type { ReasonInput } from "@/lib/pipeline/reason";

const base: ReasonInput = {
  frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,xxxx" }],
  segmentation: null,
  transcript: null,
  spaceName: "Sanctuary",
  spaceType: "church sanctuary",
  durationSec: 60,
};

describe("buildReasonPrompt newline space name and space type", () => {
  test("rejects a newline in the space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "Sanctu\nary" }),
      /buildReasonPrompt: spaceName must not contain a newline/,
    );
  });

  test("rejects a carriage return in the space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "Sanctu\rary" }),
      /buildReasonPrompt: spaceName must not contain a newline/,
    );
  });

  test("rejects a newline in the space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: "church\nsanctuary" }),
      /buildReasonPrompt: spaceType must not contain a newline/,
    );
  });

  test("rejects a carriage return in the space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: "church\rsanctuary" }),
      /buildReasonPrompt: spaceType must not contain a newline/,
    );
  });

  test("keeps a clean space name and space type in the prompt", () => {
    const prompt = buildReasonPrompt(base);
    assert.match(prompt, /Sanctuary/);
    assert.match(prompt, /church sanctuary/);
  });

  test("still allows newlines in the transcript", () => {
    const prompt = buildReasonPrompt({
      ...base,
      transcript: "First line.\nSecond line.",
    });
    assert.ok(prompt.includes("First line.\nSecond line."));
  });
});
