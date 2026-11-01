/**
 * buildReasonPrompt rejects a double quote in the space name, instead
 * of printing it verbatim, so the quoted name in the template (called
 * "{{space_name}}" and step 11's Set spaceName to "{{space_name}}")
 * cannot be closed early. spaceType is printed unquoted everywhere in
 * this template, so a quote there is left alone.
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

describe("buildReasonPrompt double quote in space name", () => {
  test("rejects a double quote in the space name", () => {
    assert.throws(
      () => buildReasonPrompt({ ...base, spaceName: 'Sanctu"ary' }),
      /buildReasonPrompt: spaceName must not contain a double quote/,
    );
  });

  test("keeps a clean space name in the prompt", () => {
    const prompt = buildReasonPrompt(base);
    assert.match(prompt, /Sanctuary/);
  });

  test("still allows an apostrophe in the space name", () => {
    const prompt = buildReasonPrompt({
      ...base,
      spaceName: "St. Mary's Hall",
    });
    assert.ok(prompt.includes("St. Mary's Hall"));
  });

  test("still allows a double quote in the space type", () => {
    const prompt = buildReasonPrompt({
      ...base,
      spaceType: 'church "sanctuary"',
    });
    assert.ok(prompt.includes('church "sanctuary"'));
  });
});
