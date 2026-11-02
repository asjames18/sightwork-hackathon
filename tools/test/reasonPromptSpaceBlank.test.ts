/**
 * buildReasonPrompt rejects a blank space name or space type when
 * given, instead of silently falling back to "Walkthrough" or
 * "room" — the caller never learned the name was blank, and the
 * model planned a generic Walkthrough rather than the space that
 * was filmed. runReason's own validator already rejects a blank
 * space name or space type when given before any paid call, so a
 * direct buildReasonPrompt caller bypassing runReason gets the
 * same fail-fast here. An omitted field still falls back to the
 * default, and a non-blank name still builds.
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

describe("buildReasonPrompt space name and space type blank", () => {
  test("rejects an empty string space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "" }),
      /buildReasonPrompt: spaceName must not be blank when given/,
    );
  });

  test("rejects a whitespace-only space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: "   " }),
      /buildReasonPrompt: spaceName must not be blank when given/,
    );
  });

  test("rejects an empty string space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: "" }),
      /buildReasonPrompt: spaceType must not be blank when given/,
    );
  });

  test("rejects a whitespace-only space type", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceType: " \t " }),
      /buildReasonPrompt: spaceType must not be blank when given/,
    );
  });

  test("still falls back when the space name is omitted", () => {
    const { spaceName, ...rest } = base;
    const prompt = buildReasonPrompt(rest);
    assert.ok(prompt.includes("Walkthrough"));
  });

  test("still falls back when the space type is omitted", () => {
    const { spaceType, ...rest } = base;
    const prompt = buildReasonPrompt(rest);
    assert.ok(prompt.includes("room"));
  });

  test("still builds a clean reason prompt with a non-blank name", () => {
    const prompt = buildReasonPrompt(base);
    assert.ok(prompt.includes("Sanctuary"));
    assert.doesNotMatch(prompt, /\{\{[a-z_]+\}\}/);
  });
});
