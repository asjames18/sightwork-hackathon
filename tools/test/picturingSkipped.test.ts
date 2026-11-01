/**
 * formatPicturingSkipped (server log only, picturing step): reports why the after picture was
 * skipped, so a real run says whether picturing skipped cleanly, failed on the model, or hit the
 * spike cap — the finished plan's meta.skipped keeps only a boolean, so the reason is otherwise
 * lost. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatPicturingSkipped } from "@/lib/pipeline/runPlan";

describe("formatPicturingSkipped", () => {
  test("no skip stays quiet", () => {
    assert.equal(formatPicturingSkipped(undefined), null);
  });

  test("no frames is reported", () => {
    assert.equal(
      formatPicturingSkipped("no-frames"),
      "runPlan: picturing skipped: no-frames",
    );
  });

  test("no visible changes is reported", () => {
    assert.equal(
      formatPicturingSkipped("no-visible-changes"),
      "runPlan: picturing skipped: no-visible-changes",
    );
  });

  test("model failure is reported", () => {
    assert.equal(
      formatPicturingSkipped("model-failure"),
      "runPlan: picturing skipped: model-failure",
    );
  });

  test("cap exceeded is reported", () => {
    assert.equal(
      formatPicturingSkipped("cap-exceeded"),
      "runPlan: picturing skipped: cap-exceeded",
    );
  });

  test("unknown reason stays quiet", () => {
    assert.equal(formatPicturingSkipped("other"), null);
  });

  test("empty reason stays quiet", () => {
    assert.equal(formatPicturingSkipped(""), null);
  });
});
