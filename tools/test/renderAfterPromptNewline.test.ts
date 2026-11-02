/**
 * Render-after prompts (prompt 04) reject a newline in the space type
 * or in a change entry, instead of printing it into the prompt: a
 * newline in the space type would split the edit prompt's first
 * sentence, and a newline inside a change entry would print as a
 * second, unbulleted line in the Change only list — a line the image
 * model could read as an extra requested change, or the judge as an
 * extra change to compare against. Both builders share the change
 * check, so the judge prompt gets the same fail-fast. Clean prompts
 * still build verbatim, and the blank / empty checks are unchanged.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildRenderAfterPrompt,
  buildJudgePrompt,
} from "@/lib/pipeline/renderAfter";

describe("renderAfter prompt newline", () => {
  test("rejects a newline in the space type", () => {
    assert.throws(
      () => buildRenderAfterPrompt("church\nsanctuary", ["Repaint the wall"]),
      /buildRenderAfterPrompt spaceType must not contain a newline/,
    );
  });

  test("rejects a carriage return in the space type", () => {
    assert.throws(
      () => buildRenderAfterPrompt("church\rsanctuary", ["Repaint the wall"]),
      /buildRenderAfterPrompt spaceType must not contain a newline/,
    );
  });

  test("rejects a newline in an edit-prompt change entry", () => {
    assert.throws(
      () => buildRenderAfterPrompt("room", ["Repaint\nthe wall"]),
      /visibleChanges\[0\] must not contain a newline/,
    );
  });

  test("rejects a newline in a judge-prompt change entry, with its index", () => {
    assert.throws(
      () => buildJudgePrompt(["Repaint the wall", "Mount\nthe extinguisher"]),
      /visibleChanges\[1\] must not contain a newline/,
    );
  });

  test("still builds clean edit and judge prompts verbatim", () => {
    const edit = buildRenderAfterPrompt("church sanctuary", [
      "Repaint the wall",
      "Mount the extinguisher",
    ]);
    assert.match(edit, /Photo edit of this exact church sanctuary photo/);
    assert.match(edit, /- Repaint the wall\n- Mount the extinguisher/);
    const judge = buildJudgePrompt(["Repaint the wall"]);
    assert.match(judge, /- Repaint the wall/);
  });

  test("blank and empty checks are unchanged", () => {
    assert.throws(
      () => buildRenderAfterPrompt("   ", ["Repaint the wall"]),
      /must be a non-empty string/,
    );
    assert.throws(
      () => buildRenderAfterPrompt("room", []),
      /needs a non-empty visibleChanges array/,
    );
    assert.throws(
      () => buildJudgePrompt(["  "]),
      /must be a non-empty string/,
    );
  });
});
